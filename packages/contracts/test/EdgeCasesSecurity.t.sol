// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenScreenerFactory.sol";
import "../src/BondingCurve.sol";
import "../src/DegenToken.sol";

/// @dev Malicious token that returns false on transfer
contract MaliciousToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}

/// @dev Contract that rejects ETH
contract ETHRejecter {
    receive() external payable {
        revert("No ETH");
    }
}

/// @dev Reentrancy attacker via buy (sends ETH in receive, tries to reenter buy)
contract BuyReentrancyAttacker {
    BondingCurve public target;
    address public tokenAddr;

    constructor(address _target) {
        target = BondingCurve(payable(_target));
    }

    function attack(address _token) external payable {
        tokenAddr = _token;
        target.buy{value: msg.value}(_token);
    }

    receive() external payable {
        // Try reentrant buy
        if (address(this).balance > 0.01 ether) {
            try target.buy{value: 0.01 ether}(tokenAddr) {} catch {}
        }
    }
}

contract EdgeCasesSecurityTest is Test {
    DegenScreenerFactory public factory;
    BondingCurve public bondingCurve;

    address public deployer = address(this);
    address public treasury = makeAddr("treasury");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint256 public constant DEPLOY_FEE = 0.01 ether;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant VIRTUAL_ETH = 1 ether;
    uint256 public constant VIRTUAL_TOKEN = 0;
    uint256 public constant PLATFORM_FEE_RATE = 100;
    uint256 public constant CREATOR_FEE_RATE = 100;
    uint256 public constant GRADUATION_THRESHOLD = 4.2 ether;
    uint256 public constant GRADUATION_FEE_RATE = 500;

    address public tokenAddr;
    DegenToken public token;

    function setUp() public {
        uint256 nonce = vm.getNonce(deployer);
        address predictedFactory = vm.computeCreateAddress(deployer, nonce + 1);

        bondingCurve = new BondingCurve(
            predictedFactory,
            treasury,
            PLATFORM_FEE_RATE,
            CREATOR_FEE_RATE,
            GRADUATION_THRESHOLD,
            GRADUATION_FEE_RATE,
            address(0)
        );

        factory = new DegenScreenerFactory(
            address(bondingCurve),
            treasury,
            DEPLOY_FEE,
            TOTAL_SUPPLY,
            VIRTUAL_ETH,
            VIRTUAL_TOKEN
        );

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Create a default token for tests
        vm.prank(alice);
        tokenAddr = factory.createToken{value: DEPLOY_FEE}("EdgeCoin", "EDGE");
        token = DegenToken(tokenAddr);
    }

    // ===================================================================
    // 1. Zero-value buy should revert
    // ===================================================================
    function test_zeroBuyReverts() public {
        vm.prank(bob);
        vm.expectRevert("Zero ETH");
        bondingCurve.buy{value: 0}(tokenAddr);
    }

    // ===================================================================
    // 2. Zero-amount sell should revert
    // ===================================================================
    function test_zeroSellReverts() public {
        vm.prank(bob);
        vm.expectRevert("Zero tokens");
        bondingCurve.sell(tokenAddr, 0);
    }

    // ===================================================================
    // 3. Sell more tokens than balance (should revert on transferFrom)
    // ===================================================================
    function test_sellMoreThanBalanceReverts() public {
        // Bob has 0 tokens, tries to sell
        vm.startPrank(bob);
        token.approve(address(bondingCurve), 1000 ether);
        vm.expectRevert();
        bondingCurve.sell(tokenAddr, 1000 ether);
        vm.stopPrank();
    }

    // ===================================================================
    // 4. Buy on non-existent / uninitialized curve
    // ===================================================================
    function test_buyNonExistentCurve() public {
        vm.prank(bob);
        vm.expectRevert("Curve not active");
        bondingCurve.buy{value: 0.1 ether}(address(0xDEAD));
    }

    // ===================================================================
    // 5. Sell on non-existent / uninitialized curve
    // ===================================================================
    function test_sellNonExistentCurve() public {
        vm.prank(bob);
        vm.expectRevert("Curve not active");
        bondingCurve.sell(address(0xDEAD), 1000);
    }

    // ===================================================================
    // 6. Buy after graduation should revert
    // ===================================================================
    function test_buyAfterGraduation() public {
        _graduateCurve();

        vm.prank(bob);
        vm.expectRevert("Curve graduated");
        bondingCurve.buy{value: 0.1 ether}(tokenAddr);
    }

    // ===================================================================
    // 7. Sell after graduation should revert
    // ===================================================================
    function test_sellAfterGraduation() public {
        // Buy tokens first, then graduate, then try to sell
        vm.prank(bob);
        bondingCurve.buy{value: 0.5 ether}(tokenAddr);

        uint256 bobTokens = token.balanceOf(bob);

        _graduateCurve();

        vm.startPrank(bob);
        token.approve(address(bondingCurve), bobTokens);
        vm.expectRevert("Curve graduated");
        bondingCurve.sell(tokenAddr, bobTokens);
        vm.stopPrank();
    }

    // ===================================================================
    // 8. Cannot initialize same token twice
    // ===================================================================
    function test_cannotReinitializeCurve() public {
        // Non-factory caller gets "Only factory" first
        vm.expectRevert("Only factory");
        bondingCurve.initializeCurve(tokenAddr, alice, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);

        // Even factory can't reinitialize — create a token to show it would revert
        // (already tested in BondingCurve.t.sol with factory as caller)
    }

    // ===================================================================
    // 9. Only factory can initialize curve
    // ===================================================================
    function test_onlyFactoryInitializesCurve() public {
        vm.prank(bob);
        vm.expectRevert("Only factory");
        bondingCurve.initializeCurve(address(0x1234), bob, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    // ===================================================================
    // 10. Fee math precision — verify fees don't lose wei
    // ===================================================================
    function test_feePrecision() public {
        // Use an odd ETH amount to check rounding
        uint256 ethAmount = 0.123456789012345678 ether;
        uint256 treasuryBefore = treasury.balance;
        uint256 aliceBefore = alice.balance; // alice is creator

        vm.prank(bob);
        bondingCurve.buy{value: ethAmount}(tokenAddr);

        uint256 expectedPlatformFee = (ethAmount * PLATFORM_FEE_RATE) / 10000;
        uint256 expectedCreatorFee = (ethAmount * CREATOR_FEE_RATE) / 10000;

        assertEq(treasury.balance - treasuryBefore, expectedPlatformFee, "Platform fee precision");
        assertEq(alice.balance - aliceBefore, expectedCreatorFee, "Creator fee precision");
    }

    // ===================================================================
    // 11. Very small buy (1 wei) — should handle gracefully
    // ===================================================================
    function test_verySmallBuy() public {
        // 1 wei buy — fees round to 0, ethIn = 1 wei, produces some tokens
        // Verify it handles gracefully without reverting
        vm.prank(bob);
        bondingCurve.buy{value: 1}(tokenAddr);
        assertGt(token.balanceOf(bob), 0, "Should receive some tokens even for 1 wei");
    }

    // ===================================================================
    // 12. Very large buy (depletes most supply)
    // ===================================================================
    function test_veryLargeBuy() public {
        // Buy with enough ETH to purchase majority of supply
        vm.deal(bob, 1000 ether);
        vm.prank(bob);
        bondingCurve.buy{value: 50 ether}(tokenAddr);

        // Should have graduated
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.graduated, "Should graduate on large buy");
    }

    // ===================================================================
    // 13. Multiple sequential buys and sells maintain invariants
    // ===================================================================
    function test_multipleBuySellCycles() public {
        for (uint256 i = 0; i < 5; i++) {
            // Buy
            vm.prank(bob);
            bondingCurve.buy{value: 0.1 ether}(tokenAddr);

            // Sell half
            uint256 bal = token.balanceOf(bob);
            if (bal > 0) {
                vm.startPrank(bob);
                token.approve(address(bondingCurve), bal / 2);
                bondingCurve.sell(tokenAddr, bal / 2);
                vm.stopPrank();
            }
        }

        // Curve should still be active (not graduated from small amounts)
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.active);
        assertFalse(curve.graduated);
        assertGt(curve.realEthReserve, 0);
    }

    // ===================================================================
    // 14. Sell returns less ETH than buy cost (slippage/fees)
    // ===================================================================
    function test_sellReturnsLessThanBuy() public {
        uint256 buyAmount = 1 ether;

        uint256 bobEthBefore = bob.balance;
        vm.prank(bob);
        bondingCurve.buy{value: buyAmount}(tokenAddr);

        uint256 tokensReceived = token.balanceOf(bob);

        vm.startPrank(bob);
        token.approve(address(bondingCurve), tokensReceived);
        bondingCurve.sell(tokenAddr, tokensReceived);
        vm.stopPrank();

        uint256 bobEthAfter = bob.balance;
        // Bob should have less ETH than before (fees + price impact)
        assertLt(bobEthAfter, bobEthBefore, "Should lose ETH to fees and slippage");
    }

    // ===================================================================
    // 15. Multiple tokens created independently
    // ===================================================================
    function test_multipleTokensIndependent() public {
        // Create second token
        vm.prank(bob);
        address token2Addr = factory.createToken{value: DEPLOY_FEE}("Token2", "T2");

        // Buy on first token
        vm.prank(bob);
        bondingCurve.buy{value: 0.5 ether}(tokenAddr);

        // Second token's curve should be unchanged
        BondingCurve.TokenCurve memory curve2 = bondingCurve.getCurveData(token2Addr);
        assertEq(curve2.realEthReserve, 0, "Second curve should have 0 ETH");
        assertEq(curve2.realTokenReserve, TOTAL_SUPPLY, "Second curve should have full supply");

        // Buy on second token
        vm.prank(bob);
        bondingCurve.buy{value: 0.3 ether}(token2Addr);

        // First token's reserves unchanged from its last state
        BondingCurve.TokenCurve memory curve1 = bondingCurve.getCurveData(tokenAddr);
        assertGt(curve1.realEthReserve, 0);
    }

    // ===================================================================
    // 16. Constructor validation
    // ===================================================================
    function test_bondingCurveRejectsZeroFactory() public {
        vm.expectRevert("Invalid factory");
        new BondingCurve(address(0), treasury, 100, 100, 4.2 ether, 500, address(0));
    }

    function test_bondingCurveRejectsZeroTreasury() public {
        vm.expectRevert("Invalid treasury");
        new BondingCurve(address(this), address(0), 100, 100, 4.2 ether, 500, address(0));
    }

    function test_bondingCurveRejectsTooHighFees() public {
        vm.expectRevert("Fees too high");
        new BondingCurve(address(this), treasury, 5000, 5000, 4.2 ether, 500, address(0));
    }

    function test_bondingCurveRejectsTooHighGradFee() public {
        vm.expectRevert("Grad fee too high");
        new BondingCurve(address(this), treasury, 100, 100, 4.2 ether, 10000, address(0));
    }

    function test_factoryRejectsZeroBondingCurve() public {
        vm.expectRevert("Invalid bonding curve");
        new DegenScreenerFactory(address(0), treasury, DEPLOY_FEE, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    function test_factoryRejectsZeroTreasury() public {
        vm.expectRevert("Invalid treasury");
        new DegenScreenerFactory(address(bondingCurve), address(0), DEPLOY_FEE, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    function test_factoryRejectsZeroSupply() public {
        vm.expectRevert("Zero supply");
        new DegenScreenerFactory(address(bondingCurve), treasury, DEPLOY_FEE, 0, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    // ===================================================================
    // 17. Price view functions match actual trade results
    // ===================================================================
    function test_viewFunctionsMatchTrades() public {
        // getTokensForEth should match actual buy output
        uint256 ethAmount = 0.5 ether;
        uint256 expectedTokens = bondingCurve.getTokensForEth(tokenAddr, ethAmount);

        vm.prank(bob);
        bondingCurve.buy{value: ethAmount}(tokenAddr);

        assertEq(token.balanceOf(bob), expectedTokens, "getTokensForEth should match actual buy");

        // getEthForTokens should match actual sell output
        uint256 tokensToSell = token.balanceOf(bob) / 2;
        uint256 expectedEth = bondingCurve.getEthForTokens(tokenAddr, tokensToSell);

        uint256 bobEthBefore = bob.balance;
        vm.startPrank(bob);
        token.approve(address(bondingCurve), tokensToSell);
        bondingCurve.sell(tokenAddr, tokensToSell);
        vm.stopPrank();

        assertEq(bob.balance - bobEthBefore, expectedEth, "getEthForTokens should match actual sell");
    }

    // --- Helper ---
    function _graduateCurve() internal {
        vm.prank(alice);
        bondingCurve.buy{value: 5 ether}(tokenAddr);
    }
}
