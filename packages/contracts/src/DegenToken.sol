// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DegenToken — Fair-launch ERC-20 with 4% transfer tax
/// @notice All supply minted to the bonding curve. Post-graduation Uniswap
///         swaps are taxed at 4% (3% to creator, 1% to platform treasury).
///         Bonding curve transfers are exempt (fees handled by BondingCurve contract).
contract DegenToken is ERC20 {
    /// @notice The address that created this token (attribution only, no privileges)
    address public immutable creator;

    /// @notice Creator wallet — receives 3% of taxed transfers
    address public immutable creatorWallet;

    /// @notice Platform treasury — receives 1% of taxed transfers
    address public immutable platformTreasury;

    /// @notice Bonding curve contract — tax-exempt
    address public immutable bondingCurve;

    uint256 public constant CREATOR_TAX_BPS = 300; // 3%
    uint256 public constant PLATFORM_TAX_BPS = 100; // 1%
    uint256 public constant TOTAL_TAX_BPS = 400; // 4%

    /// @notice Addresses exempt from transfer tax (set once in constructor)
    mapping(address => bool) public taxExempt;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        address _bondingCurve,
        address _creatorWallet,
        address _platformTreasury
    ) ERC20(_name, _symbol) {
        require(_bondingCurve != address(0), "Invalid bonding curve");
        require(_creatorWallet != address(0), "Invalid creator wallet");
        require(_platformTreasury != address(0), "Invalid treasury");
        require(_totalSupply > 0, "Zero supply");

        creator = msg.sender;
        bondingCurve = _bondingCurve;
        creatorWallet = _creatorWallet;
        platformTreasury = _platformTreasury;

        // Bonding curve is tax-exempt (it charges its own fees)
        taxExempt[_bondingCurve] = true;

        _mint(_bondingCurve, _totalSupply);
    }

    /// @dev Override _update to apply transfer tax on non-exempt transfers.
    ///      No tax on mint/burn or transfers involving the bonding curve.
    function _update(address from, address to, uint256 amount) internal override {
        // Mint or burn — no tax
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Tax-exempt addresses (bonding curve)
        if (taxExempt[from] || taxExempt[to]) {
            super._update(from, to, amount);
            return;
        }

        // Apply 4% transfer tax: 3% to creator, 1% to platform
        uint256 creatorTax = (amount * CREATOR_TAX_BPS) / 10000;
        uint256 platformTax = (amount * PLATFORM_TAX_BPS) / 10000;
        uint256 amountAfterTax = amount - creatorTax - platformTax;

        super._update(from, to, amountAfterTax);
        if (creatorTax > 0) super._update(from, creatorWallet, creatorTax);
        if (platformTax > 0) super._update(from, platformTreasury, platformTax);
    }
}
