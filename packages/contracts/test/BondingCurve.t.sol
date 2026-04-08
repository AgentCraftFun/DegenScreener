// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BondingCurve.sol";
import "../src/DegenToken.sol";

/// @dev Attacker contract that reenters BondingCurve.sell on receiving ETH
contract ReentrancyAttacker {
    BondingCurve public target;
    address public tokenAddr;
    uint256 public sellAmount;

    constructor(address _target) {
        target = BondingCurve(payable(_target));
    }

    function setup(address _token, uint256 _sellAmount) external {
        tokenAddr = _token;
        sellAmount = _sellAmount;
        // Approve double (for the main sell + reentrant sell)
        IERC20(_token).approve(address(target), _sellAmount * 2);
    }

    function attackSell() external {
        target.sell(tokenAddr, sellAmount);
    }

    receive() external payable {
        // Try to reenter sell when receiving ETH
        if (IERC20(tokenAddr).balanceOf(address(this)) >= sellAmount) {
            target.sell(tokenAddr, sellAmount);
        }
    }
}

contract BondingCurveTest is Test {
    BondingCurve public bondingCurve;
    DegenToken public token;

    address public factory = address(this); // test contract acts as factory
    address public treasury = makeAddr("treasury");
    address public creator = makeAddr("creator");
    address public buyer = makeAddr("buyer");
    address public seller = makeAddr("seller");

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens
    uint256 public constant VIRTUAL_ETH = 1 ether;
    uint256 public constant VIRTUAL_TOKEN = 0; // pump.fun model: all tokens are real
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1%
    uint256 public constant CREATOR_FEE_RATE = 100; // 1%
    uint256 public constant GRADUATION_THRESHOLD = 4.2 ether;
    uint256 public constant GRADUATION_FEE_RATE = 500; // 5%

    function setUp() public {
        // Deploy bonding curve (this contract is the factory)
        bondingCurve = new BondingCurve(
            factory,
            treasury,
            PLATFORM_FEE_RATE,
            CREATOR_FEE_RATE,
            GRADUATION_THRESHOLD,
            GRADUATION_FEE_RATE,
            address(0) // no uniswap router for tests
        );

        // Deploy token with bonding curve as recipient
        vm.prank(creator);
        token = new DegenToken("TestToken", "TEST", TOTAL_SUPPLY, address(bondingCurve));

        // Initialize the curve (this contract is the factory)
        bondingCurve.initializeCurve(
            address(token),
            creator,
            TOTAL_SUPPLY,
            VIRTUAL_ETH,
            VIRTUAL_TOKEN
        );

        // Fund test accounts
        vm.deal(buyer, 100 ether);
        vm.deal(seller, 100 ether);
    }

    // --- Initialization Tests ---

    function test_curveInitialized() public view {
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(address(token));
        assertTrue(curve.active);
        assertFalse(curve.graduated);
        assertEq(curve.creator, creator);
        assertEq(curve.virtualEthReserve, VIRTUAL_ETH);
        assertEq(curve.virtualTokenReserve, VIRTUAL_TOKEN);
        assertEq(curve.realEthReserve, 0);
        assertEq(curve.realTokenReserve, TOTAL_SUPPLY);
        assertEq(curve.kConstant, VIRTUAL_ETH * (VIRTUAL_TOKEN + TOTAL_SUPPLY));
    }

    function test_cannotReinitialize() public {
        vm.expectRevert("Already initialized");
        bondingCurve.initializeCurve(address(token), creator, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    function test_onlyFactoryCanInitialize() public {
        vm.prank(buyer);
        vm.expectRevert("Only factory");
        bondingCurve.initializeCurve(address(0x1234), creator, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN);
    }

    // --- Buy Tests ---

    function test_buyTokens() public {
        uint256 ethAmount = 0.1 ether;
        uint256 treasuryBefore = treasury.balance;
        uint256 creatorBefore = creator.balance;

        vm.prank(buyer);
        bondingCurve.buy{value: ethAmount}(address(token));

        // Buyer should have received tokens
        uint256 tokensReceived = token.balanceOf(buyer);
        assertGt(tokensReceived, 0, "Should receive tokens");

        // Verify CPMM math
        uint256 platformFee = (ethAmount * PLATFORM_FEE_RATE) / 10000;
        uint256 creatorFee = (ethAmount * CREATOR_FEE_RATE) / 10000;
        uint256 ethIn = ethAmount - platformFee - creatorFee;

        uint256 k = VIRTUAL_ETH * (VIRTUAL_TOKEN + TOTAL_SUPPLY);
        uint256 totalEthBefore = VIRTUAL_ETH; // realEth was 0
        uint256 totalTokenBefore = VIRTUAL_TOKEN + TOTAL_SUPPLY;
        uint256 newTotalEth = totalEthBefore + ethIn;
        uint256 expectedTokensOut = totalTokenBefore - (k / newTotalEth);

        assertEq(tokensReceived, expectedTokensOut, "CPMM math mismatch");

        // Verify fees
        assertEq(treasury.balance - treasuryBefore, platformFee, "Platform fee mismatch");
        assertEq(creator.balance - creatorBefore, creatorFee, "Creator fee mismatch");

        // Verify reserves updated
        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(address(token));
        assertEq(curve.realEthReserve, ethIn, "Real ETH reserve mismatch");
        assertEq(curve.realTokenReserve, TOTAL_SUPPLY - tokensReceived, "Real token reserve mismatch");
    }

    function test_buyZeroEthReverts() public {
        vm.prank(buyer);
        vm.expectRevert("Zero ETH");
        bondingCurve.buy{value: 0}(address(token));
    }

    function test_priceIncreasesWithBuys() public {
        uint256 priceBefore = bondingCurve.getPrice(address(token));

        vm.prank(buyer);
        bondingCurve.buy{value: 0.1 ether}(address(token));

        uint256 priceAfter = bondingCurve.getPrice(address(token));
        assertGt(priceAfter, priceBefore, "Price should increase after buy");
    }

    // --- Sell Tests ---

    function test_sellTokens() public {
        // First buy some tokens
        vm.prank(buyer);
        bondingCurve.buy{value: 0.1 ether}(address(token));

        uint256 tokensBought = token.balanceOf(buyer);
        uint256 tokensToSell = tokensBought / 2;

        uint256 buyerEthBefore = buyer.balance;
        uint256 treasuryBefore = treasury.balance;
        uint256 creatorBefore = creator.balance;

        // Approve and sell
        vm.startPrank(buyer);
        token.approve(address(bondingCurve), tokensToSell);
        bondingCurve.sell(address(token), tokensToSell);
        vm.stopPrank();

        // Buyer should have received ETH
        uint256 ethReceived = buyer.balance - buyerEthBefore;
        assertGt(ethReceived, 0, "Should receive ETH");

        // Fees should have been sent
        assertGt(treasury.balance - treasuryBefore, 0, "Treasury should receive fee");
        assertGt(creator.balance - creatorBefore, 0, "Creator should receive fee");

        // Verify token balance
        assertEq(token.balanceOf(buyer), tokensBought - tokensToSell, "Token balance mismatch");
    }

    function test_sellZeroTokensReverts() public {
        vm.prank(buyer);
        vm.expectRevert("Zero tokens");
        bondingCurve.sell(address(token), 0);
    }

    function test_priceDecreasesWithSells() public {
        // Buy first
        vm.prank(buyer);
        bondingCurve.buy{value: 0.5 ether}(address(token));

        uint256 priceBefore = bondingCurve.getPrice(address(token));

        uint256 tokensBought = token.balanceOf(buyer);
        vm.startPrank(buyer);
        token.approve(address(bondingCurve), tokensBought);
        bondingCurve.sell(address(token), tokensBought);
        vm.stopPrank();

        uint256 priceAfter = bondingCurve.getPrice(address(token));
        assertLt(priceAfter, priceBefore, "Price should decrease after sell");
    }

    // --- Cannot withdraw more ETH than realEthReserve ---

    function test_sellCappedToRealEthReserve() public {
        // Buy a small amount
        vm.prank(buyer);
        bondingCurve.buy{value: 0.01 ether}(address(token));

        BondingCurve.TokenCurve memory curveBefore = bondingCurve.getCurveData(address(token));
        uint256 realEthBefore = curveBefore.realEthReserve;

        // Sell back all tokens — ETH out should not exceed realEthReserve
        uint256 tokensBought = token.balanceOf(buyer);
        vm.startPrank(buyer);
        token.approve(address(bondingCurve), tokensBought);
        bondingCurve.sell(address(token), tokensBought);
        vm.stopPrank();

        BondingCurve.TokenCurve memory curveAfter = bondingCurve.getCurveData(address(token));
        // realEthReserve should be >= 0 (no underflow)
        assertGe(curveAfter.realEthReserve, 0, "Real ETH reserve underflow");
        assertLe(realEthBefore - curveAfter.realEthReserve, realEthBefore, "Withdrew more than real ETH");
    }

    // --- Inactive / Graduated curve ---

    function test_cannotBuyInactiveCurve() public {
        address fakeToken = address(0xDEAD);
        vm.prank(buyer);
        vm.expectRevert("Curve not active");
        bondingCurve.buy{value: 0.1 ether}(fakeToken);
    }

    function test_cannotSellInactiveCurve() public {
        address fakeToken = address(0xDEAD);
        vm.prank(buyer);
        vm.expectRevert("Curve not active");
        bondingCurve.sell(fakeToken, 1000);
    }

    function test_cannotBuyGraduatedCurve() public {
        // Push curve to graduation by buying with large amount
        _graduateCurve();

        vm.deal(seller, 1 ether);
        vm.prank(seller);
        vm.expectRevert("Curve graduated");
        bondingCurve.buy{value: 0.1 ether}(address(token));
    }

    function test_cannotSellGraduatedCurve() public {
        _graduateCurve();

        vm.startPrank(buyer);
        token.approve(address(bondingCurve), 1000);
        vm.expectRevert("Curve graduated");
        bondingCurve.sell(address(token), 1000);
        vm.stopPrank();
    }

    // --- Graduation ---

    function test_graduationOnThreshold() public {
        BondingCurve.TokenCurve memory curveBefore = bondingCurve.getCurveData(address(token));
        assertFalse(curveBefore.graduated);

        _graduateCurve();

        BondingCurve.TokenCurve memory curveAfter = bondingCurve.getCurveData(address(token));
        assertTrue(curveAfter.graduated, "Curve should be graduated");
        assertEq(curveAfter.realEthReserve, 0, "Real ETH should be zero after graduation");
        assertEq(curveAfter.realTokenReserve, 0, "Real tokens should be zero after graduation");
    }

    // --- View functions ---

    function test_getTokensForEth() public view {
        uint256 tokensOut = bondingCurve.getTokensForEth(address(token), 0.1 ether);
        assertGt(tokensOut, 0, "Should return positive token amount");
    }

    function test_getEthForTokens() public {
        // First buy some tokens to put ETH in the curve
        vm.prank(buyer);
        bondingCurve.buy{value: 0.5 ether}(address(token));

        uint256 ethOut = bondingCurve.getEthForTokens(address(token), 1000 ether);
        assertGt(ethOut, 0, "Should return positive ETH amount");
    }

    function test_getPrice() public view {
        uint256 price = bondingCurve.getPrice(address(token));
        assertGt(price, 0, "Price should be positive");
    }

    // --- Reentrancy ---

    function test_reentrancyAttackFails() public {
        // Deploy attacker
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(bondingCurve));

        // Buy tokens then transfer half to attacker
        vm.prank(buyer);
        bondingCurve.buy{value: 1 ether}(address(token));

        uint256 tokensBought = token.balanceOf(buyer);
        uint256 halfTokens = tokensBought / 2;

        vm.prank(buyer);
        token.transfer(address(attacker), tokensBought);

        // Set up attacker: will sell halfTokens, then try to reenter with the other half
        attacker.setup(address(token), halfTokens);

        // The reentrant call should revert with ReentrancyGuardReentrantCall
        vm.expectRevert();
        attacker.attackSell();
    }

    // --- Sell fee math verification ---

    function test_sellFeesMathCorrect() public {
        // Buy some tokens first
        vm.prank(buyer);
        bondingCurve.buy{value: 1 ether}(address(token));

        uint256 tokensBought = token.balanceOf(buyer);
        uint256 tokensToSell = tokensBought / 2;

        // Get expected ETH out from view function
        uint256 expectedEthOut = bondingCurve.getEthForTokens(address(token), tokensToSell);

        uint256 buyerEthBefore = buyer.balance;

        vm.startPrank(buyer);
        token.approve(address(bondingCurve), tokensToSell);
        bondingCurve.sell(address(token), tokensToSell);
        vm.stopPrank();

        uint256 actualEthOut = buyer.balance - buyerEthBefore;
        assertEq(actualEthOut, expectedEthOut, "Actual ETH out should match view function");
    }

    // --- Helper ---

    function _graduateCurve() internal {
        // With virtualToken=0, virtualEth=1 ETH, totalSupply=1B:
        // k = 1e18 * 1e27 = 1e45
        // Need realEthReserve >= 4.2 ETH after fees
        // 4.2 / 0.98 ≈ 4.286 ETH — send 5 to be safe
        vm.prank(buyer);
        bondingCurve.buy{value: 5 ether}(address(token));
    }
}
