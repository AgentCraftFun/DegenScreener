// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenScreenerFactory.sol";
import "../src/BondingCurve.sol";
import "../src/DegenToken.sol";

/// @notice Full lifecycle test: create → buy → graduate → verify locked
contract GraduationLifecycleTest is Test {
    DegenScreenerFactory public factory;
    BondingCurve public bondingCurve;

    address public deployer = address(this);
    address public treasury = makeAddr("treasury");

    address public alice = makeAddr("alice"); // token creator
    address public bob = makeAddr("bob"); // buyer 1
    address public charlie = makeAddr("charlie"); // buyer 2

    uint256 public constant DEPLOY_FEE = 0.01 ether;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant VIRTUAL_ETH = 1 ether;
    uint256 public constant VIRTUAL_TOKEN = 0;
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1%
    uint256 public constant CREATOR_FEE_RATE = 100; // 1%
    uint256 public constant GRADUATION_THRESHOLD = 4.2 ether;
    uint256 public constant GRADUATION_FEE_RATE = 500; // 5%

    function setUp() public {
        // Predict factory address
        uint256 nonce = vm.getNonce(deployer);
        address predictedFactory = vm.computeCreateAddress(deployer, nonce + 1);

        bondingCurve = new BondingCurve(
            predictedFactory,
            treasury,
            PLATFORM_FEE_RATE,
            CREATOR_FEE_RATE,
            GRADUATION_THRESHOLD,
            GRADUATION_FEE_RATE,
            address(0) // no uniswap router — graduation sends to treasury
        );

        factory = new DegenScreenerFactory(
            address(bondingCurve),
            treasury,
            DEPLOY_FEE,
            TOTAL_SUPPLY,
            VIRTUAL_ETH,
            VIRTUAL_TOKEN
        );

        assertEq(address(factory), predictedFactory);

        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);
        vm.deal(charlie, 50 ether);
    }

    /// @notice Full lifecycle: create → buys → graduation → locked
    function test_fullLifecycle() public {
        // === Phase 1: Token Creation ===
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("MoonCoin", "MOON");
        DegenToken token = DegenToken(tokenAddr);

        // Verify initial state
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.active);
        assertFalse(curve.graduated);
        assertEq(curve.realEthReserve, 0);
        assertEq(curve.realTokenReserve, TOTAL_SUPPLY);

        // === Phase 2: Multiple Buys ===
        uint256 priceBefore = bondingCurve.getPrice(tokenAddr);

        // Bob buys 1 ETH worth
        vm.prank(bob);
        bondingCurve.buy{value: 1 ether}(tokenAddr);
        uint256 bobTokens = token.balanceOf(bob);
        assertGt(bobTokens, 0, "Bob should have tokens");

        uint256 priceAfterBob = bondingCurve.getPrice(tokenAddr);
        assertGt(priceAfterBob, priceBefore, "Price should rise after Bob buys");

        // Charlie buys 1 ETH worth
        vm.prank(charlie);
        bondingCurve.buy{value: 1 ether}(tokenAddr);
        uint256 charlieTokens = token.balanceOf(charlie);
        assertGt(charlieTokens, 0, "Charlie should have tokens");
        // Charlie gets fewer tokens than Bob (price is higher)
        assertLt(charlieTokens, bobTokens, "Charlie should get fewer tokens due to higher price");

        uint256 priceAfterCharlie = bondingCurve.getPrice(tokenAddr);
        assertGt(priceAfterCharlie, priceAfterBob, "Price should keep rising");

        // Verify curve state midway
        curve = bondingCurve.getCurveData(tokenAddr);
        assertFalse(curve.graduated, "Should not be graduated yet");
        assertGt(curve.realEthReserve, 0, "Should have real ETH");

        // === Phase 3: Graduation ===
        uint256 treasuryBefore = treasury.balance;

        // Bob buys big to push past graduation threshold
        // After fees, need realEthReserve >= 4.2 ETH. We already have ~1.96 ETH in curve.
        // Need ~2.24 more in curve. 2.24/0.98 ≈ 2.29 ETH. Send 3 to be safe.
        vm.prank(bob);
        bondingCurve.buy{value: 3 ether}(tokenAddr);

        // Verify graduation happened
        curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.graduated, "Curve should be graduated");
        assertEq(curve.realEthReserve, 0, "All real ETH should be sent out");
        assertEq(curve.realTokenReserve, 0, "All real tokens should be sent out");

        // Treasury should have received ETH (graduation fee + deploy fee)
        uint256 treasuryReceived = treasury.balance - treasuryBefore;
        assertGt(treasuryReceived, 0, "Treasury should receive graduation ETH");

        // === Phase 4: Verify Locked After Graduation ===

        // Cannot buy
        vm.prank(charlie);
        vm.expectRevert("Curve graduated");
        bondingCurve.buy{value: 0.1 ether}(tokenAddr);

        // Cannot sell
        vm.startPrank(bob);
        token.approve(address(bondingCurve), 1000 ether);
        vm.expectRevert("Curve graduated");
        bondingCurve.sell(tokenAddr, 1000 ether);
        vm.stopPrank();

        // Token holders still have their tokens (can transfer freely)
        uint256 bobFinalTokens = token.balanceOf(bob);
        assertGt(bobFinalTokens, 0, "Bob should still have tokens");
        uint256 charlieFinalTokens = token.balanceOf(charlie);
        assertGt(charlieFinalTokens, 0, "Charlie should still have tokens");

        // Standard ERC-20 transfers still work
        vm.prank(bob);
        token.transfer(charlie, 1000 ether);
        assertEq(token.balanceOf(charlie), charlieFinalTokens + 1000 ether);
    }

    /// @notice Test graduation fee math
    function test_graduationFeeDistribution() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("FeeCoin", "FEE");

        // Track all platform fees from buys
        uint256 treasuryBefore = treasury.balance;

        // Buy enough to graduate in one shot
        vm.prank(bob);
        bondingCurve.buy{value: 5 ether}(tokenAddr);

        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.graduated, "Should be graduated");

        // Treasury should have received: platform fees from buy + graduation fee
        uint256 totalTreasuryReceived = treasury.balance - treasuryBefore;
        assertGt(totalTreasuryReceived, 0);

        // The graduation sends all ETH to treasury (no uniswap), so treasury gets:
        // platform fee from buy + full realEthReserve (including what would be grad fee + LP portion)
        // Since no uniswap router, _graduate sends totalEth to treasury + tokens to treasury
    }

    /// @notice Graduation with incremental buys (many small buys)
    function test_graduationWithIncrementalBuys() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("SlowGrad", "SLOW");

        // Many small buys
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(bob);
            bondingCurve.buy{value: 0.5 ether}(tokenAddr);

            BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
            if (curve.graduated) break;
        }

        BondingCurve.TokenCurve memory finalCurve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(finalCurve.graduated, "Should eventually graduate");
    }

    /// @notice Sell tokens before graduation, then graduate
    function test_sellThenGraduate() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("SellFirst", "SELL");

        // Bob buys
        vm.prank(bob);
        bondingCurve.buy{value: 2 ether}(tokenAddr);

        // Bob sells half
        uint256 bobTokens = DegenToken(tokenAddr).balanceOf(bob);
        vm.startPrank(bob);
        DegenToken(tokenAddr).approve(address(bondingCurve), bobTokens / 2);
        bondingCurve.sell(tokenAddr, bobTokens / 2);
        vm.stopPrank();

        // Verify not graduated yet
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertFalse(curve.graduated, "Should not be graduated after sell");

        // Charlie buys big to push past threshold
        vm.prank(charlie);
        bondingCurve.buy{value: 5 ether}(tokenAddr);

        curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.graduated, "Should be graduated now");
    }

    /// @notice Create token via factory, verify the bonding curve holds all supply
    function test_supplyFullyInBondingCurve() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("FullSupply", "FULL");

        DegenToken token = DegenToken(tokenAddr);
        assertEq(token.balanceOf(address(bondingCurve)), TOTAL_SUPPLY);
        assertEq(token.balanceOf(alice), 0, "Creator should have 0 tokens");
        assertEq(token.balanceOf(address(factory)), 0, "Factory should have 0 tokens");
    }

    /// @notice Creator receives fees during trading
    function test_creatorReceivesFees() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("CreatorFee", "CFEE");

        uint256 aliceBefore = alice.balance;

        vm.prank(bob);
        bondingCurve.buy{value: 1 ether}(tokenAddr);

        uint256 aliceAfter = alice.balance;
        uint256 expectedCreatorFee = (1 ether * CREATOR_FEE_RATE) / 10000; // 1%
        assertEq(aliceAfter - aliceBefore, expectedCreatorFee, "Alice should receive creator fee");
    }
}
