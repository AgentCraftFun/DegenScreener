// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BondingCurve — CPMM bonding curve with fee collection and graduation
/// @notice Manages per-token virtual-reserve bonding curves (Pump.fun model)
contract BondingCurve is ReentrancyGuard {
    struct TokenCurve {
        bool active;
        bool graduated;
        address creator;
        uint256 virtualEthReserve;
        uint256 virtualTokenReserve;
        uint256 realEthReserve;
        uint256 realTokenReserve;
        uint256 tokenSupply;
        uint256 kConstant;
        address uniswapPair;
    }

    // --- Immutable config ---
    address public immutable factory;
    address public immutable treasury;
    uint256 public immutable platformFeeRate; // basis points
    uint256 public immutable creatorFeeRate; // basis points
    uint256 public immutable graduationThreshold; // real ETH threshold for graduation
    uint256 public immutable graduationFeeRate; // basis points
    address public immutable uniswapRouter;

    // --- State ---
    mapping(address => TokenCurve) public curves;

    // --- Events ---
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 ethAmount,
        uint256 tokenAmount,
        uint256 price
    );
    event TokenGraduated(
        address indexed token, uint256 ethLiquidity, uint256 tokenLiquidity, address uniswapPair
    );
    event CurveInitialized(address indexed token, address indexed creator, uint256 virtualEth, uint256 virtualToken);

    constructor(
        address _factory,
        address _treasury,
        uint256 _platformFeeRate,
        uint256 _creatorFeeRate,
        uint256 _graduationThreshold,
        uint256 _graduationFeeRate,
        address _uniswapRouter
    ) {
        require(_factory != address(0), "Invalid factory");
        require(_treasury != address(0), "Invalid treasury");
        require(_platformFeeRate + _creatorFeeRate < 10000, "Fees too high");
        require(_graduationFeeRate < 10000, "Grad fee too high");
        factory = _factory;
        treasury = _treasury;
        platformFeeRate = _platformFeeRate;
        creatorFeeRate = _creatorFeeRate;
        graduationThreshold = _graduationThreshold;
        graduationFeeRate = _graduationFeeRate;
        uniswapRouter = _uniswapRouter;
    }

    // --- Modifiers ---
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    modifier curveActive(address token) {
        require(curves[token].active, "Curve not active");
        require(!curves[token].graduated, "Curve graduated");
        _;
    }

    // --- Initialize ---
    function initializeCurve(
        address token,
        address creator,
        uint256 totalSupply,
        uint256 virtualEth,
        uint256 virtualToken
    ) external onlyFactory {
        require(!curves[token].active, "Already initialized");
        require(token != address(0), "Invalid token");

        // k = totalEthReserve * totalTokenReserve at initialization
        // totalEth = virtualEth (realEth starts at 0)
        // totalToken = virtualToken + totalSupply (virtual + real)
        uint256 k = virtualEth * (virtualToken + totalSupply);

        curves[token] = TokenCurve({
            active: true,
            graduated: false,
            creator: creator,
            virtualEthReserve: virtualEth,
            virtualTokenReserve: virtualToken,
            realEthReserve: 0,
            realTokenReserve: totalSupply,
            tokenSupply: totalSupply,
            kConstant: k,
            uniswapPair: address(0)
        });

        emit CurveInitialized(token, creator, virtualEth, virtualToken);
    }

    // --- Buy ---
    function buy(address token) external payable nonReentrant curveActive(token) {
        require(msg.value > 0, "Zero ETH");

        TokenCurve storage curve = curves[token];

        uint256 tokensOut;
        uint256 platformFee;
        uint256 creatorFee;
        {
            // Calculate fees
            platformFee = (msg.value * platformFeeRate) / 10000;
            creatorFee = (msg.value * creatorFeeRate) / 10000;
            uint256 ethIn = msg.value - platformFee - creatorFee;

            // CPMM: calculate tokens out
            uint256 totalEthReserve = curve.virtualEthReserve + curve.realEthReserve;
            uint256 totalTokenReserve = curve.virtualTokenReserve + curve.realTokenReserve;
            uint256 newTotalEth = totalEthReserve + ethIn;
            tokensOut = totalTokenReserve - (curve.kConstant / newTotalEth);

            // Cap tokensOut to available real tokens
            require(tokensOut > 0, "Insufficient output");
            require(tokensOut <= curve.realTokenReserve, "Not enough tokens in curve");

            // Update reserves
            curve.realEthReserve += ethIn;
            curve.realTokenReserve -= tokensOut;
        }

        // Transfer tokens to buyer
        require(IERC20(token).transfer(msg.sender, tokensOut), "Token transfer failed");

        // Send fees
        _sendEth(treasury, platformFee);
        _sendEth(curve.creator, creatorFee);

        uint256 price = getPrice(token);
        emit Trade(token, msg.sender, true, msg.value, tokensOut, price);

        // Check graduation
        if (curve.realEthReserve >= graduationThreshold) {
            _graduate(token);
        }
    }

    // --- Sell ---
    function sell(address token, uint256 tokenAmount) external nonReentrant curveActive(token) {
        require(tokenAmount > 0, "Zero tokens");

        TokenCurve storage curve = curves[token];

        // Transfer tokens from seller to this contract
        require(IERC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");

        // CPMM: calculate ETH out
        uint256 ethOutGross;
        {
            uint256 totalTokenReserve = curve.virtualTokenReserve + curve.realTokenReserve;
            uint256 totalEthReserve = curve.virtualEthReserve + curve.realEthReserve;
            uint256 newTotalToken = totalTokenReserve + tokenAmount;
            ethOutGross = totalEthReserve - (curve.kConstant / newTotalToken);
        }

        // Cannot withdraw more than real ETH
        if (ethOutGross > curve.realEthReserve) {
            ethOutGross = curve.realEthReserve;
        }

        // Fees
        uint256 platformFee = (ethOutGross * platformFeeRate) / 10000;
        uint256 creatorFee = (ethOutGross * creatorFeeRate) / 10000;
        uint256 ethOut = ethOutGross - platformFee - creatorFee;

        // Update reserves
        curve.realEthReserve -= ethOutGross;
        curve.realTokenReserve += tokenAmount;

        // Transfer ETH to seller
        _sendEth(msg.sender, ethOut);

        // Send fees
        _sendEth(treasury, platformFee);
        _sendEth(curve.creator, creatorFee);

        uint256 price = getPrice(token);
        emit Trade(token, msg.sender, false, ethOutGross, tokenAmount, price);
    }

    // --- View functions ---
    function getPrice(address token) public view returns (uint256) {
        TokenCurve storage curve = curves[token];
        uint256 totalEth = curve.virtualEthReserve + curve.realEthReserve;
        uint256 totalToken = curve.virtualTokenReserve + curve.realTokenReserve;
        if (totalToken == 0) return 0;
        // Price in wei per token (scaled by 1e18)
        return (totalEth * 1e18) / totalToken;
    }

    function getTokensForEth(address token, uint256 ethAmount) external view returns (uint256) {
        TokenCurve storage curve = curves[token];
        uint256 platformFee = (ethAmount * platformFeeRate) / 10000;
        uint256 creatorFee = (ethAmount * creatorFeeRate) / 10000;
        uint256 ethIn = ethAmount - platformFee - creatorFee;

        uint256 totalEthReserve = curve.virtualEthReserve + curve.realEthReserve;
        uint256 totalTokenReserve = curve.virtualTokenReserve + curve.realTokenReserve;
        uint256 newTotalEth = totalEthReserve + ethIn;
        uint256 tokensOut = totalTokenReserve - (curve.kConstant / newTotalEth);

        if (tokensOut > curve.realTokenReserve) {
            tokensOut = curve.realTokenReserve;
        }
        return tokensOut;
    }

    function getEthForTokens(address token, uint256 tokenAmount) external view returns (uint256) {
        TokenCurve storage curve = curves[token];
        uint256 totalTokenReserve = curve.virtualTokenReserve + curve.realTokenReserve;
        uint256 totalEthReserve = curve.virtualEthReserve + curve.realEthReserve;
        uint256 newTotalToken = totalTokenReserve + tokenAmount;
        uint256 ethOutGross = totalEthReserve - (curve.kConstant / newTotalToken);

        if (ethOutGross > curve.realEthReserve) {
            ethOutGross = curve.realEthReserve;
        }

        uint256 platformFee = (ethOutGross * platformFeeRate) / 10000;
        uint256 creatorFee = (ethOutGross * creatorFeeRate) / 10000;
        return ethOutGross - platformFee - creatorFee;
    }

    function getCurveData(address token) external view returns (TokenCurve memory) {
        return curves[token];
    }

    // --- Internal ---
    function _graduate(address token) internal {
        TokenCurve storage curve = curves[token];
        curve.graduated = true;

        uint256 totalEth = curve.realEthReserve;
        uint256 gradFee = (totalEth * graduationFeeRate) / 10000;
        uint256 ethForLP = totalEth - gradFee;
        uint256 tokensForLP = curve.realTokenReserve;

        // Zero out reserves
        curve.realEthReserve = 0;
        curve.realTokenReserve = 0;

        // If no uniswap router is configured, just send everything to treasury
        if (uniswapRouter == address(0)) {
            _sendEth(treasury, totalEth);
            IERC20(token).transfer(treasury, tokensForLP);
            emit TokenGraduated(token, ethForLP, tokensForLP, address(0));
            return;
        }

        // Approve router to spend tokens
        IERC20(token).approve(uniswapRouter, tokensForLP);

        // Add liquidity via Uniswap V2 Router
        // LP tokens go to burn address (permanent liquidity)
        address burnAddress = address(0xdead);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = uniswapRouter.call{value: ethForLP}(
            abi.encodeWithSignature(
                "addLiquidityETH(address,uint256,uint256,uint256,address,uint256)",
                token,
                tokensForLP,
                0, // amountTokenMin
                0, // amountETHMin
                burnAddress,
                block.timestamp + 300
            )
        );

        if (success) {
            // Get the pair address from the Uniswap factory
            (bool factorySuccess, bytes memory factoryData) = uniswapRouter.call(
                abi.encodeWithSignature("factory()")
            );
            if (factorySuccess && factoryData.length >= 32) {
                address uniFactory = abi.decode(factoryData, (address));
                // Get WETH address
                (bool wethSuccess, bytes memory wethData) = uniswapRouter.call(
                    abi.encodeWithSignature("WETH()")
                );
                if (wethSuccess && wethData.length >= 32) {
                    address weth = abi.decode(wethData, (address));
                    (bool pairSuccess, bytes memory pairData) = uniFactory.call(
                        abi.encodeWithSignature("getPair(address,address)", token, weth)
                    );
                    if (pairSuccess && pairData.length >= 32) {
                        curve.uniswapPair = abi.decode(pairData, (address));
                    }
                }
            }

            _sendEth(treasury, gradFee);
            emit TokenGraduated(token, ethForLP, tokensForLP, curve.uniswapPair);
        } else {
            // If LP creation fails, revert the graduation
            curve.graduated = false;
            curve.realEthReserve = totalEth;
            curve.realTokenReserve = tokensForLP;
            // Reset approval
            IERC20(token).approve(uniswapRouter, 0);
            revert("Graduation failed: LP creation reverted");
        }
    }

    function _sendEth(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // Allow receiving ETH (for refunds from Uniswap etc.)
    receive() external payable {}
}
