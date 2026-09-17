// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PactFactory} from "../src/PactFactory.sol";

/// @notice forge script script/Deploy.s.sol --rpc-url $MONAD_RPC --broadcast
/// @dev FEE_RECIPIENT may be 0x0 (falls back to deployer).
contract Deploy is Script {
    function run() external returns (PactFactory factory) {
        address feeRecipient = vm.envOr("FEE_RECIPIENT", address(0));
        vm.startBroadcast();
        factory = new PactFactory(feeRecipient);
        vm.stopBroadcast();
        console.log("PactFactory:", address(factory));
        console.log("implementation:", factory.implementation());
        console.log("feeBps:", factory.feeBps());
        console.log("feeRecipient:", factory.feeRecipient());
    }
}
