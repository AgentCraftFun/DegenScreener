/**
 * V2 Types — Real on-chain token launchpad (Pump.fun model on Base)
 *
 * These types supplement the existing simulation types and represent
 * real blockchain state for the V2 launchpad pivot.
 */

// ========================
// Enums
// ========================

/** Lifecycle phase of a token on the bonding curve */
export enum TokenPhase {
  /** Token is active on bonding curve, trading enabled */
  BONDING_CURVE = "BONDING_CURVE",
  /** Token has met graduation threshold, migrating to DEX */
  GRADUATING = "GRADUATING",
  /** Token graduated to Uniswap, bonding curve locked */
  GRADUATED = "GRADUATED",
  /** Graduation failed (LP creation reverted) */
  GRADUATION_FAILED = "GRADUATION_FAILED",
}

/** Source of a trade — on-chain bonding curve vs DEX */
export enum TradeSource {
  BONDING_CURVE = "BONDING_CURVE",
  UNISWAP = "UNISWAP",
}

/** On-chain transaction status */
export enum TxStatus {
  PENDING = "PENDING",
  CONFIRMING = "CONFIRMING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  REVERTED = "REVERTED",
}

// ========================
// Interfaces
// ========================

/** On-chain token created via DegenScreenerFactory */
export interface V2Token {
  /** Contract address on Base */
  address: string;
  /** Token name */
  name: string;
  /** Token ticker/symbol */
  symbol: string;
  /** Creator wallet address */
  creatorAddress: string;
  /** Total supply (string for precision, in wei) */
  totalSupply: string;
  /** Current lifecycle phase */
  phase: TokenPhase;
  /** Virtual ETH reserve at initialization */
  virtualEthReserve: string;
  /** Virtual token reserve at initialization */
  virtualTokenReserve: string;
  /** Current real ETH in bonding curve (wei) */
  realEthReserve: string;
  /** Current real tokens in bonding curve (wei) */
  realTokenReserve: string;
  /** Current price in wei per token (scaled 1e18) */
  currentPrice: string;
  /** Market cap in ETH */
  marketCapEth: string;
  /** 24h trading volume in ETH */
  volume24hEth: string;
  /** Number of unique holders */
  holderCount: number;
  /** Number of trades */
  tradeCount: number;
  /** Uniswap pair address (set after graduation) */
  uniswapPair: string | null;
  /** Block number when token was created */
  createdAtBlock: number;
  /** Timestamp when token was created */
  createdAt: Date;
  /** Block number when token graduated (null if not graduated) */
  graduatedAtBlock: number | null;
  /** Factory transaction hash */
  deployTxHash: string;
}

/** On-chain trade executed on the bonding curve or DEX */
export interface V2Trade {
  /** Unique trade ID (txHash + logIndex) */
  id: string;
  /** Token contract address */
  tokenAddress: string;
  /** Trader wallet address */
  traderAddress: string;
  /** Buy or sell */
  type: "BUY" | "SELL";
  /** Source: bonding curve or uniswap */
  source: TradeSource;
  /** ETH amount in wei */
  ethAmount: string;
  /** Token amount in wei */
  tokenAmount: string;
  /** Price at time of trade (wei per token, scaled 1e18) */
  price: string;
  /** Platform fee in wei */
  platformFee: string;
  /** Creator fee in wei */
  creatorFee: string;
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp */
  timestamp: Date;
}

/** Wallet that interacts with the launchpad */
export interface AgentWallet {
  /** Wallet address */
  address: string;
  /** Optional ENS name */
  ensName: string | null;
  /** ETH balance in wei */
  ethBalance: string;
  /** Number of tokens created */
  tokensCreated: number;
  /** Total trading volume in ETH */
  totalVolumeEth: string;
  /** Total PnL in ETH */
  totalPnlEth: string;
  /** First seen timestamp */
  firstSeenAt: Date;
}

/** Trending topic derived from token launches and trading activity */
export interface TrendingTopic {
  /** Topic keyword or hashtag */
  topic: string;
  /** Number of tokens mentioning this topic */
  tokenCount: number;
  /** Combined volume of related tokens in ETH */
  volumeEth: string;
  /** Trend direction: up, down, or flat */
  trend: "UP" | "DOWN" | "FLAT";
  /** When this topic started trending */
  since: Date;
}

/** News item from external sources or on-chain events */
export interface NewsItem {
  /** Unique ID */
  id: string;
  /** Headline */
  title: string;
  /** Brief summary */
  summary: string;
  /** Source (e.g., "on-chain", "twitter", "news") */
  source: string;
  /** URL to full article/source (optional) */
  url: string | null;
  /** Related token addresses */
  relatedTokens: string[];
  /** Published timestamp */
  publishedAt: Date;
}

/** Bonding curve state snapshot (mirrors on-chain struct) */
export interface CurveState {
  /** Whether the curve is active */
  active: boolean;
  /** Whether the curve has graduated */
  graduated: boolean;
  /** Creator wallet address */
  creator: string;
  /** Virtual ETH reserve (wei) */
  virtualEthReserve: string;
  /** Virtual token reserve (wei) */
  virtualTokenReserve: string;
  /** Real ETH reserve (wei) */
  realEthReserve: string;
  /** Real token reserve (wei) */
  realTokenReserve: string;
  /** Total token supply (wei) */
  tokenSupply: string;
  /** k constant (wei^2) */
  kConstant: string;
  /** Uniswap pair address */
  uniswapPair: string;
}

/** Graduation event data */
export interface GraduationEvent {
  /** Token contract address */
  tokenAddress: string;
  /** ETH liquidity added to Uniswap */
  ethLiquidity: string;
  /** Token liquidity added to Uniswap */
  tokenLiquidity: string;
  /** Uniswap pair address */
  uniswapPair: string;
  /** Graduation fee sent to treasury */
  graduationFee: string;
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp */
  timestamp: Date;
}
