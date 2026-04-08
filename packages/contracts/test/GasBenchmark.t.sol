// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DegenScreenerFactory.sol";
import "../src/BondingCurve.sol";
import "../src/DegenToken.sol";

/// @notice Gas benchmark tests — validates gas targets are met
contract GasBenchmarkTest is Test {
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

    address public tokenAddr;

    function setUp() public {
        uint256 nonce = vm.getNonce(deployer);
        address predictedFactory = vm.computeCreateAddress(deployer, nonce + 1);

        bondingCurve = new BondingCurve(
            predictedFactory, treasury, 100, 300, 4.2 ether, 500, address(0)
        );

        factory = new DegenScreenerFactory(
            address(bondingCurve), treasury, DEPLOY_FEE, TOTAL_SUPPLY, VIRTUAL_ETH, VIRTUAL_TOKEN
        );

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        vm.prank(alice);
        tokenAddr = factory.createToken{value: DEPLOY_FEE}("BenchToken", "BENCH");
    }

    /// @notice buy() should cost < 150k gas
    function test_gasBuy() public {
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        bondingCurve.buy{value: 0.1 ether}(tokenAddr);
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 150_000, "buy() exceeds 150k gas target");
        emit log_named_uint("buy() gas", gasUsed);
    }

    /// @notice sell() should cost < 150k gas
    function test_gasSell() public {
        // Setup: buy first
        vm.prank(bob);
        bondingCurve.buy{value: 0.5 ether}(tokenAddr);

        uint256 tokensToSell = DegenToken(tokenAddr).balanceOf(bob) / 2;

        vm.startPrank(bob);
        DegenToken(tokenAddr).approve(address(bondingCurve), tokensToSell);

        uint256 gasBefore = gasleft();
        bondingCurve.sell(tokenAddr, tokensToSell);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        assertLt(gasUsed, 150_000, "sell() exceeds 150k gas target");
        emit log_named_uint("sell() gas", gasUsed);
    }

    /// @notice createToken() should cost < 2M gas
    function test_gasCreateToken() public {
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        factory.createToken{value: DEPLOY_FEE}("GasTest", "GAS");
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 2_000_000, "createToken() exceeds 2M gas target");
        emit log_named_uint("createToken() gas", gasUsed);
    }
}
