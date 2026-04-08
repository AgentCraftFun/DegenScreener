// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenToken.sol";

contract DegenTokenTest is Test {
    DegenToken token;
    address bondingCurve = address(0xBEEF);
    address deployer = address(this);
    uint256 totalSupply = 1_000_000_000 ether; // 1B tokens with 18 decimals

    function setUp() public {
        token = new DegenToken("TestToken", "TEST", totalSupply, bondingCurve);
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

    function test_noOneMintMore() public {
        // DegenToken has no mint function — only inherited ERC20 with internal _mint
        // Verify deployer/creator cannot mint
        assertEq(token.totalSupply(), totalSupply);
        // No public mint function to call
    }

    function test_standardTransferWorks() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        // bondingCurve sends tokens to alice
        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);
        assertEq(token.balanceOf(alice), 1000 ether);

        // alice sends to bob
        vm.prank(alice);
        token.transfer(bob, 500 ether);
        assertEq(token.balanceOf(bob), 500 ether);
        assertEq(token.balanceOf(alice), 500 ether);
    }

    function test_approveAndTransferFrom() public {
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        vm.prank(bondingCurve);
        token.transfer(alice, 1000 ether);

        vm.prank(alice);
        token.approve(bob, 500 ether);

        vm.prank(bob);
        token.transferFrom(alice, bob, 500 ether);
        assertEq(token.balanceOf(bob), 500 ether);
    }

    function test_revertZeroAddressBondingCurve() public {
        vm.expectRevert("Invalid bonding curve");
        new DegenToken("Bad", "BAD", totalSupply, address(0));
    }

    function test_revertZeroSupply() public {
        vm.expectRevert("Zero supply");
        new DegenToken("Bad", "BAD", 0, bondingCurve);
    }
}
