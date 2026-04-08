// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DegenToken — Minimal fair-launch ERC-20
/// @notice All supply minted to the bonding curve on deploy. No owner functions.
contract DegenToken is ERC20 {
    /// @notice The address that created this token (attribution only, no privileges)
    address public immutable creator;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _bondingCurve
    ) ERC20(_name, _symbol) {
        require(_bondingCurve != address(0), "Invalid bonding curve");
        require(_totalSupply > 0, "Zero supply");
        creator = msg.sender;
        _mint(_bondingCurve, _totalSupply);
    }
}
