// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DScreen} from "../src/DScreen.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        DScreen token = new DScreen(deployer);
        console.log("DScreen deployed at", address(token));
        console.log("Owner:", deployer);
        vm.stopBroadcast();
    }
}
