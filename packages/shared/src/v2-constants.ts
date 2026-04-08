/**
 * V2 Constants — On-chain launchpad configuration
 *
 * These mirror the smart contract immutable values and are used
 * by the frontend, API, and indexer for consistent configuration.
 */

// --- Chain ---
export const V2_CHAIN_ID = 84532; // Base Sepolia (testnet)
export const V2_CHAIN_NAME = "Base Sepolia";

// --- Contract Addresses (to be updated after deployment) ---
export const V2_CONTRACTS = {
  bondingCurve: "" as `0x${string}`,
  factory: "" as `0x${string}`,
  treasury: "" as `0x${string}`,
} as const;

// --- Fee Rates (basis points) ---
// Fees apply on ALL trades: pre-bond (via BondingCurve contract) AND post-bond
// (via DegenToken transfer tax). 3% to token creator, 1% to platform treasury.
export const V2_PLATFORM_FEE_BPS = 100; // 1%
export const V2_CREATOR_FEE_BPS = 300; // 3%
export const V2_GRADUATION_FEE_BPS = 500; // 5% (one-time on graduation)
export const V2_TOTAL_TRADE_FEE_BPS = V2_PLATFORM_FEE_BPS + V2_CREATOR_FEE_BPS; // 4%
export const V2_TOKEN_TRANSFER_TAX_BPS = 400; // 4% on post-graduation transfers

// --- Token Config ---
export const V2_TOKEN_TOTAL_SUPPLY = "1000000000000000000000000000"; // 1B * 1e18 (wei)
export const V2_TOKEN_TOTAL_SUPPLY_FORMATTED = "1,000,000,000"; // 1B human readable
export const V2_TOKEN_DECIMALS = 18;
export const V2_DEPLOY_FEE_WEI = "10000000000000000"; // 0.01 ETH in wei
export const V2_DEPLOY_FEE_ETH = "0.01";

// --- Bonding Curve ---
export const V2_VIRTUAL_ETH_WEI = "1000000000000000000"; // 1 ETH in wei
export const V2_VIRTUAL_TOKEN_WEI = "0"; // pump.fun model: no virtual tokens
export const V2_GRADUATION_THRESHOLD_WEI = "4200000000000000000"; // 4.2 ETH in wei
export const V2_GRADUATION_THRESHOLD_ETH = "4.2";

// --- Uniswap ---
export const V2_UNISWAP_V2_ROUTER_BASE = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // Uniswap V2 Router on Base
export const V2_LP_BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

// --- Polling / Indexing ---
export const V2_BLOCK_POLL_INTERVAL_MS = 2000; // 2s (Base has 2s blocks)
export const V2_PRICE_UPDATE_INTERVAL_MS = 5000; // 5s price ticker updates
export const V2_MAX_BLOCKS_PER_QUERY = 1000; // Max blocks to scan per indexer query
