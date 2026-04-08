// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenScreenerFactory.sol";
import "../src/BondingCurve.sol";
import "../src/DegenToken.sol";

contract DegenScreenerFactoryTest is Test {
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

    function setUp() public {
        // Deploy bonding curve first — factory address not known yet, use placeholder
        // We'll deploy factory, then re-deploy bonding curve with correct factory address
        // Actually, BondingCurve.factory is immutable, so we need to predict factory address

        // Predict factory address: next contract deployed by this address
        uint256 nonce = vm.getNonce(deployer);
        // BondingCurve is deployed at nonce, factory at nonce+1
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

        // Verify prediction worked
        assertEq(address(factory), predictedFactory, "Factory address prediction failed");

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // --- Token Creation ---

    function test_createToken() public {
        uint256 treasuryBefore = treasury.balance;

        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("DogeCoin", "DOGE");

        // Token exists
        assertTrue(tokenAddr != address(0), "Token address should not be zero");
        assertTrue(factory.isDegenToken(tokenAddr), "Should be registered as degen token");

        // Token properties
        DegenToken token = DegenToken(tokenAddr);
        assertEq(token.name(), "DogeCoin");
        assertEq(token.symbol(), "DOGE");
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
        assertEq(token.creator(), address(factory), "Creator should be factory (msg.sender of DegenToken constructor)");

        // All supply held by bonding curve
        assertEq(token.balanceOf(address(bondingCurve)), TOTAL_SUPPLY);

        // Deploy fee sent to treasury
        assertEq(treasury.balance - treasuryBefore, DEPLOY_FEE, "Treasury should receive deploy fee");

        // Token tracked
        assertEq(factory.allTokensLength(), 1);
        assertEq(factory.getTokenAtIndex(0), tokenAddr);
    }

    function test_createTokenInitializesCurve() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("PepeCoin", "PEPE");

        BondingCurve.TokenCurve memory curve = bondingCurve.getCurveData(tokenAddr);
        assertTrue(curve.active, "Curve should be active");
        assertFalse(curve.graduated, "Curve should not be graduated");
        assertEq(curve.creator, alice, "Creator should be alice");
        assertEq(curve.virtualEthReserve, VIRTUAL_ETH);
        assertEq(curve.virtualTokenReserve, VIRTUAL_TOKEN);
        assertEq(curve.realTokenReserve, TOTAL_SUPPLY);
        assertEq(curve.realEthReserve, 0);
    }

    function test_createMultipleTokens() public {
        vm.prank(alice);
        address token1 = factory.createToken{value: DEPLOY_FEE}("Token1", "T1");

        vm.prank(bob);
        address token2 = factory.createToken{value: DEPLOY_FEE}("Token2", "T2");

        assertEq(factory.allTokensLength(), 2);
        assertTrue(token1 != token2, "Tokens should have different addresses");
        assertTrue(factory.isDegenToken(token1));
        assertTrue(factory.isDegenToken(token2));
    }

    function test_canBuyAfterCreation() public {
        vm.prank(alice);
        address tokenAddr = factory.createToken{value: DEPLOY_FEE}("BuyMe", "BUY");

        // Bob buys tokens
        vm.prank(bob);
        bondingCurve.buy{value: 0.1 ether}(tokenAddr);

        assertGt(DegenToken(tokenAddr).balanceOf(bob), 0, "Bob should have tokens");
    }

    // --- Fee validation ---

    function test_revertInsufficientFee() public {
        vm.prank(alice);
        vm.expectRevert("Insufficient deploy fee");
        factory.createToken{value: 0.005 ether}("Bad", "BAD");
    }

    function test_createWithExcessFee() public {
        uint256 treasuryBefore = treasury.balance;

        vm.prank(alice);
        factory.createToken{value: 0.05 ether}("Excess", "EXC");

        // Full msg.value goes to treasury
        assertEq(treasury.balance - treasuryBefore, 0.05 ether);
    }

    function test_createWithZeroFeeWhenFeeIsZero() public {
        // Owner sets fee to 0
        factory.setDeployFee(0);

        vm.prank(alice);
        address tokenAddr = factory.createToken{value: 0}("Free", "FREE");
        assertTrue(tokenAddr != address(0));
    }

    // --- Input validation ---

    function test_revertEmptyName() public {
        vm.prank(alice);
        vm.expectRevert("Empty name");
        factory.createToken{value: DEPLOY_FEE}("", "SYM");
    }

    function test_revertEmptySymbol() public {
        vm.prank(alice);
        vm.expectRevert("Empty symbol");
        factory.createToken{value: DEPLOY_FEE}("Name", "");
    }

    // --- Admin ---

    function test_setDeployFee() public {
        factory.setDeployFee(0.02 ether);
        assertEq(factory.deployFee(), 0.02 ether);
    }

    function test_onlyOwnerCanSetFee() public {
        vm.prank(alice);
        vm.expectRevert("Only owner");
        factory.setDeployFee(0.02 ether);
    }

    function test_setParams() public {
        factory.setParams(2_000_000_000 ether, 2 ether, 0);
        assertEq(factory.totalSupply(), 2_000_000_000 ether);
        assertEq(factory.virtualEth(), 2 ether);
        assertEq(factory.virtualToken(), 0);
    }

    function test_onlyOwnerCanSetParams() public {
        vm.prank(alice);
        vm.expectRevert("Only owner");
        factory.setParams(2_000_000_000 ether, 2 ether, 0);
    }

    // --- Event ---

    function test_emitsTokenCreated() public {
        vm.prank(alice);
        // We can't predict the exact token address, so just check the event is emitted
        vm.recordLogs();
        factory.createToken{value: DEPLOY_FEE}("EventTest", "EVT");

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < logs.length; i++) {
            // TokenCreated event signature
            if (logs[i].topics[0] == keccak256("TokenCreated(address,address,string,string,uint256,uint256)")) {
                found = true;
                // topics[2] is the indexed creator (alice)
                assertEq(address(uint160(uint256(logs[i].topics[2]))), alice);
                break;
            }
        }
        assertTrue(found, "TokenCreated event should be emitted");
    }
}
