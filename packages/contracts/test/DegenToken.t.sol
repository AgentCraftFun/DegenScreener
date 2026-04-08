// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenToken.sol";

contract DegenTokenTest is Test {
    DegenToken token;
    address bondingCurve = address(0xBEEF);
    address creatorWallet = makeAddr("creatorWallet");
    address platformTreasury = makeAddr("platformTreasury");
    address deployer = address(this);
    uint256 totalSupply = 1_000_000_000 ether; // 1B tokens with 18 decimals

    function setUp() public {
        token = new DegenToken("TestToken", "TEST", totalSupply, bondingCurve, creatorWallet, platformTreasury);
    }

    function test_totalSupplyMintedToBondingCurve() public view {
        assertEq(token.totalSupply(), totalSupply);
        assertEq(token.balanceOf(bondingCurve), totalSupply);
        assertEq(token.balanceOf(deployer), 0);
    }

    function test_creatorSetCorrectly() public view {
        assertEq(token.creator(), deployer);
    }

    function test_nameAndSymbol() public view {
        assertEq(token.name(), "TestToken");
        assertEq(token.symbol(), "TEST");
    }

    function test_noOneMintMore() public view {
        assertEq(token.totalSupply(), totalSupply);
    }

    function test_bondingCurveIsTaxExempt() public view {
        assertTrue(token.taxExempt(bondingCurve));
    }

    function test_immutableAddresses() public view {
        assertEq(token.bondingCurve(), bondingCurve);
        assertEq(token.creatorWallet(), creatorWallet);
        assertEq(token.platformTreasury(), platformTreasury);
    }

    // --- Tax-exempt transfers (bonding curve) ---

    function test_transferFromBondingCurveNoTax() public {
        address alice = address(0xA11CE);

        // bondingCurve sends tokens to alice — no tax (exempt sender)
        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);
        assertEq(token.balanceOf(alice), 1000 ether, "No tax from bonding curve");
    }

    function test_transferToBondingCurveNoTax() public {
        address alice = address(0xA11CE);

        // Give alice tokens via bonding curve (exempt)
        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);

        // Alice sends to bonding curve — no tax (exempt recipient)
        vm.prank(alice);
        token.transfer(bondingCurve, 500 ether);
        assertEq(token.balanceOf(bondingCurve), totalSupply - 1000 ether + 500 ether);
        assertEq(token.balanceOf(alice), 500 ether, "No tax to bonding curve");
    }

    // --- Taxed transfers (non-exempt) ---

    function test_taxedTransfer() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        // Give alice tokens via bonding curve (exempt)
        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);

        // Alice sends to bob — TAXED (neither is exempt)
        vm.prank(alice);
        token.transfer(bob, 1000 ether);

        uint256 expectedCreatorTax = (1000 ether * 300) / 10000; // 3% = 30 tokens
        uint256 expectedPlatformTax = (1000 ether * 100) / 10000; // 1% = 10 tokens
        uint256 expectedBobReceives = 1000 ether - expectedCreatorTax - expectedPlatformTax; // 960 tokens

        assertEq(token.balanceOf(bob), expectedBobReceives, "Bob should receive 96%");
        assertEq(token.balanceOf(creatorWallet), expectedCreatorTax, "Creator gets 3%");
        assertEq(token.balanceOf(platformTreasury), expectedPlatformTax, "Treasury gets 1%");
        assertEq(token.balanceOf(alice), 0, "Alice sent everything");
    }

    function test_taxedTransferFrom() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);

        vm.prank(alice);
        token.approve(bob, 1000 ether);

        vm.prank(bob);
        token.transferFrom(alice, bob, 500 ether);

        uint256 expectedCreatorTax = (500 ether * 300) / 10000; // 15 tokens
        uint256 expectedPlatformTax = (500 ether * 100) / 10000; // 5 tokens
        uint256 expectedBobReceives = 500 ether - expectedCreatorTax - expectedPlatformTax; // 480 tokens

        assertEq(token.balanceOf(bob), expectedBobReceives, "Bob gets 96%");
        assertEq(token.balanceOf(creatorWallet), expectedCreatorTax, "Creator gets 3%");
        assertEq(token.balanceOf(platformTreasury), expectedPlatformTax, "Treasury gets 1%");
    }

    // --- No tax on mint ---

    function test_noTaxOnMint() public view {
        // Mint happened in constructor to bonding curve
        assertEq(token.balanceOf(bondingCurve), totalSupply, "Full supply minted, no tax");
        assertEq(token.balanceOf(creatorWallet), 0, "No tax collected on mint");
        assertEq(token.balanceOf(platformTreasury), 0, "No tax collected on mint");
    }

    // --- Simulated Uniswap swap (mock Pair sends tokens) ---

    function test_uniswapSwapTaxApplied() public {
        address mockPair = makeAddr("uniswapPair");
        address buyer = makeAddr("swapBuyer");

        // Give the mock pair some tokens (simulating LP)
        vm.prank(bondingCurve);
        token.transfer(mockPair, 100_000 ether);

        // Pair sends tokens to buyer (simulating a swap output)
        vm.prank(mockPair);
        token.transfer(buyer, 10_000 ether);

        // Neither mockPair nor buyer is exempt → tax applies
        uint256 expectedCreatorTax = (10_000 ether * 300) / 10000; // 300 tokens
        uint256 expectedPlatformTax = (10_000 ether * 100) / 10000; // 100 tokens
        uint256 expectedBuyerReceives = 10_000 ether - expectedCreatorTax - expectedPlatformTax; // 9600

        assertEq(token.balanceOf(buyer), expectedBuyerReceives, "Swap buyer gets 96%");
        assertEq(token.balanceOf(creatorWallet), expectedCreatorTax, "Creator gets 3% on swap");
        assertEq(token.balanceOf(platformTreasury), expectedPlatformTax, "Treasury gets 1% on swap");
    }

    // --- Constructor validation ---

    function test_revertZeroAddressBondingCurve() public {
        vm.expectRevert("Invalid bonding curve");
        new DegenToken("Bad", "BAD", totalSupply, address(0), creatorWallet, platformTreasury);
    }

    function test_revertZeroSupply() public {
        vm.expectRevert("Zero supply");
        new DegenToken("Bad", "BAD", 0, bondingCurve, creatorWallet, platformTreasury);
    }

    function test_revertZeroCreatorWallet() public {
        vm.expectRevert("Invalid creator wallet");
        new DegenToken("Bad", "BAD", totalSupply, bondingCurve, address(0), platformTreasury);
    }

    function test_revertZeroTreasury() public {
        vm.expectRevert("Invalid treasury");
        new DegenToken("Bad", "BAD", totalSupply, bondingCurve, creatorWallet, address(0));
    }
}
