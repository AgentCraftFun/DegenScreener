import type {
  AgentType,
  AgentStatus,
  TokenStatus,
  TradeType,
  TransactionType,
  TransactionStatus,
  RiskProfile,
  Personality,
  Timeframe,
  TakeProfitStrategy,
  PositionSizing,
  LaunchStyle,
  LaunchFrequency,
} from "./enums.js";

// All money/decimal fields are represented as strings over the wire/DB to
// preserve DECIMAL(36,18) precision. Convert to Decimal in business logic.

export interface User {
  id: string;
  walletAddress: string;
  internalBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  createdAt: Date;
  lastActive: Date;
}

export interface DevAgentRiskConfig {
  launchStyle: LaunchStyle;
  launchFrequency: LaunchFrequency;
  rugProbability: number; // 0..1
  initialLiquidity: string; // DSCREEN
}

export interface DegenAgentRiskConfig {
  profile: RiskProfile;
  positionSizing: PositionSizing;
  takeProfit: TakeProfitStrategy;
  stopLossPct: number;
  takeProfitPct: number;
  maxPositions: number;
}

export type AgentRiskProfile = DevAgentRiskConfig | DegenAgentRiskConfig;

export interface Agent {
  id: string;
  ownerId: string;
  name: string;
  handle: string;
  type: AgentType;
  balance: string;
  status: AgentStatus;
  riskProfile: AgentRiskProfile;
  personality: Personality;
  totalPnl: string;
  totalVolume: string;
  totalFeesEarned: string;
  tokensLaunched: number;
  rugCount: number;
  createdAt: Date;
  avatarUrl: string | null;
  nextEvalTick: number;
}

export interface Token {
  id: string;
  ticker: string;
  name: string;
  creatorAgentId: string;
  totalSupply: string;
  status: TokenStatus;
  createdAt: Date;
}

export interface LiquidityPool {
  id: string;
  tokenId: string;
  dscreenReserve: string;
  tokenReserve: string;
  kConstant: string;
  totalVolume: string;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  agentId: string;
  tokenId: string;
  type: TradeType;
  dscreenAmount: string;
  tokenAmount: string;
  priceAtTrade: string;
  feeAmount: string;
  createdAt: Date;
}

export interface AgentHolding {
  id: string;
  agentId: string;
  tokenId: string;
  quantity: string;
  avgEntryPrice: string;
  updatedAt: Date;
}

export interface Tweet {
  id: string;
  agentId: string;
  content: string;
  tokenId: string | null;
  sentimentScore: string;
  likes: number;
  retweets: number;
  createdAt: Date;
}

export interface Candle {
  tokenId: string;
  timeframe: Timeframe;
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: string;
  fee: string;
  netAmount: string;
  txHash: string;
  status: TransactionStatus;
  createdAt: Date;
  confirmedAt: Date | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface SimulationState {
  id: number;
  currentTick: string;
  lastTickAt: Date;
  startedAt: Date;
  updatedAt: Date;
}

export interface AgentCostTracking {
  id: string;
  agentId: string;
  hourBucket: Date;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: string;
  updatedAt: Date;
}
