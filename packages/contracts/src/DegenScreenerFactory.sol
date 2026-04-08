// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DegenToken.sol";
import "./BondingCurve.sol";

/// @title DegenScreenerFactory — Deploys tokens and initializes bonding curves
/// @notice One-click token launch: pays deploy fee, creates ERC-20, sets up bonding curve
contract DegenScreenerFactory {
    // --- Immutable config ---
    address public immutable owner;
    BondingCurve public immutable bondingCurve;
    address public immutable treasury;

    // --- Configurable params ---
    uint256 public deployFee; // ETH fee to create a token
    uint256 public totalSupply; // tokens minted per launch
    uint256 public virtualEth; // virtual ETH reserve for bonding curve
    uint256 public virtualToken; // virtual token reserve for bonding curve

    // --- State ---
    address[] public allTokens;
    mapping(address => bool) public isDegenToken;

    // --- Events ---
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 timestamp
    );
    event DeployFeeUpdated(uint256 oldFee, uint256 newFee);
    event ParamsUpdated(uint256 totalSupply, uint256 virtualEth, uint256 virtualToken);

    constructor(
        address _bondingCurve,
        address _treasury,
        uint256 _deployFee,
        uint256 _totalSupply,
        uint256 _virtualEth,
        uint256 _virtualToken
    ) {
        require(_bondingCurve != address(0), "Invalid bonding curve");
        require(_treasury != address(0), "Invalid treasury");
        require(_totalSupply > 0, "Zero supply");

        owner = msg.sender;
        bondingCurve = BondingCurve(payable(_bondingCurve));
        treasury = _treasury;
        deployFee = _deployFee;
        totalSupply = _totalSupply;
        virtualEth = _virtualEth;
        virtualToken = _virtualToken;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /// @notice Create a new token and initialize its bonding curve
    /// @param name Token name
    /// @param symbol Token symbol (ticker)
    function createToken(string calldata name, string calldata symbol) external payable returns (address) {
        require(msg.value >= deployFee, "Insufficient deploy fee");
        require(bytes(name).length > 0, "Empty name");
        require(bytes(symbol).length > 0, "Empty symbol");

        // Deploy token — all supply minted to bonding curve
        // msg.sender is the creator wallet (receives 3% transfer tax post-graduation)
        DegenToken token = new DegenToken(name, symbol, totalSupply, address(bondingCurve), msg.sender, treasury);
        address tokenAddr = address(token);

        // Initialize the bonding curve for this token
        bondingCurve.initializeCurve(
            tokenAddr,
            msg.sender,
            totalSupply,
            virtualEth,
            virtualToken
        );

        // Track token
        allTokens.push(tokenAddr);
        isDegenToken[tokenAddr] = true;

        // Send deploy fee to treasury
        if (msg.value > 0) {
            (bool success,) = treasury.call{value: msg.value}("");
            require(success, "Fee transfer failed");
        }

        emit TokenCreated(tokenAddr, msg.sender, name, symbol, totalSupply, block.timestamp);

        return tokenAddr;
    }

    // --- View functions ---

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function getTokenAtIndex(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }

    // --- Admin ---

    function setDeployFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = deployFee;
        deployFee = _newFee;
        emit DeployFeeUpdated(oldFee, _newFee);
    }

    function setParams(uint256 _totalSupply, uint256 _virtualEth, uint256 _virtualToken) external onlyOwner {
        require(_totalSupply > 0, "Zero supply");
        totalSupply = _totalSupply;
        virtualEth = _virtualEth;
        virtualToken = _virtualToken;
        emit ParamsUpdated(_totalSupply, _virtualEth, _virtualToken);
    }
}
