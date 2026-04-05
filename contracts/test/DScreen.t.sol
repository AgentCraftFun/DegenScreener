// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DScreen} from "../src/DScreen.sol";

contract DScreenTest is Test {
    DScreen token;
    address owner = address(0xABCD);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.prank(owner);
        token = new DScreen(owner);
    }

    function test_initialSupply() public view {
        assertEq(token.balanceOf(owner), 1_000_000_000 ether);
    }

    function test_transfer() public {
        vm.prank(owner);
        token.transfer(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_approveAndTransferFrom() public {
        vm.prank(owner);
        token.approve(alice, 50 ether);
        vm.prank(alice);
        token.transferFrom(owner, bob, 50 ether);
        assertEq(token.balanceOf(bob), 50 ether);
    }

    function test_mint_onlyOwner() public {
        vm.prank(owner);
        token.mint(alice, 200 ether);
        assertEq(token.balanceOf(alice), 200 ether);

        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 1 ether);
    }

    function test_burn() public {
        vm.prank(owner);
        token.transfer(alice, 100 ether);
        vm.prank(alice);
        token.burn(40 ether);
        assertEq(token.balanceOf(alice), 60 ether);
    }
}
