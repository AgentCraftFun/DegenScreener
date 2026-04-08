// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BondingCurve.sol";
import "../src/DegenScreenerFactory.sol";

/// @notice Deploys the full DegenScreener contract suite to Base Sepolia
/// @dev Usage: forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
contract DeployScript is Script {
    // --- Config ---
    uint256 constant PLATFORM_FEE_RATE = 100; // 1%
    uint256 constant CREATOR_FEE_RATE = 300; // 3%
    uint256 constant GRADUATION_THRESHOLD = 4.2 ether;
    uint256 constant GRADUATION_FEE_RATE = 500; // 5%
    uint256 constant DEPLOY_FEE = 0.01 ether;
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens
    uint256 constant VIRTUAL_ETH = 1 ether;
    uint256 constant VIRTUAL_TOKEN = 0; // pump.fun model

    function run() external {
        // Load config from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address uniswapRouter = vm.envOr("UNISWAP_V2_ROUTER", address(0));

        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Uniswap Router:", uniswapRouter);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Predict factory address (deployed after BondingCurve)
        uint256 nonce = vm.getNonce(deployer);
        address predictedFactory = vm.computeCreateAddress(deployer, nonce + 1);
        console.log("Predicted Factory address:", predictedFactory);

        // Step 2: Deploy BondingCurve with predicted factory
        BondingCurve bondingCurve = new BondingCurve(
            predictedFactory,
            treasury,
            PLATFORM_FEE_RATE,
            CREATOR_FEE_RATE,
            GRADUATION_THRESHOLD,
            GRADUATION_FEE_RATE,
            uniswapRouter
        );
        console.log("BondingCurve deployed:", address(bondingCurve));

        // Step 3: Deploy Factory
        DegenScreenerFactory factory = new DegenScreenerFactory(
            address(bondingCurve),
            treasury,
            DEPLOY_FEE,
            TOTAL_SUPPLY,
            VIRTUAL_ETH,
            VIRTUAL_TOKEN
        );
        console.log("Factory deployed:", address(factory));

        // Verify prediction
        require(address(factory) == predictedFactory, "Factory address mismatch!");

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("BondingCurve:", address(bondingCurve));
        console.log("Factory:", address(factory));
        console.log("Treasury:", treasury);
        console.log("Deploy Fee:", DEPLOY_FEE);
        console.log("Platform Fee Rate:", PLATFORM_FEE_RATE, "bps");
        console.log("Creator Fee Rate:", CREATOR_FEE_RATE, "bps");
        console.log("Graduation Threshold:", GRADUATION_THRESHOLD);
        console.log("Graduation Fee Rate:", GRADUATION_FEE_RATE, "bps");
    }
}
