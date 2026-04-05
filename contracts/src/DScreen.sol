// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DScreen token - $DSCREEN
/// @notice Platform utility token for DegenScreener. Owner can mint for the
///         testnet faucet; anyone can burn their own tokens.
contract DScreen is ERC20, ERC20Burnable, Ownable {
    constructor(address initialOwner)
        ERC20("DegenScreener", "DSCREEN")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 1_000_000_000 ether);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
