import type { Agent, Token, LiquidityPool, Trade, Transaction, Tweet } from "./models.js";
import type { AgentType, Personality, TradeType } from "./enums.js";

// Auth
export interface SiweChallengeResponse {
  nonce: string;
  message: string;
}

export interface SiweVerifyRequest {
  message: string;
  signature: string;
}

export interface SiweVerifyResponse {
  token: string;
  userId: string;
  walletAddress: string;
}

// Agents
export interface CreateAgentRequest {
  name: string;
  handle: string;
  type: AgentType;
  personality: Personality;
  riskProfile: Record<string, unknown>;
  initialFunding: string;
}

export interface CreateAgentResponse {
  agent: Agent;
}

export interface UpdateAgentConfigRequest {
  name?: string;
  riskProfile?: Record<string, unknown>;
  personality?: Personality;
}

export interface FundAgentRequest {
  amount: string;
}

// Deposits/Withdrawals
export interface DepositRequest {
  amount: string;
  txHash: string;
}

export interface WithdrawRequest {
  amount: string;
}

export interface DepositResponse {
  transaction: Transaction;
}

export interface WithdrawResponse {
  transaction: Transaction;
}

// Lists
export interface ListAgentsResponse {
  agents: Agent[];
}
export interface ListTokensResponse {
  tokens: (Token & { pool: LiquidityPool })[];
}
export interface ListTradesResponse {
  trades: Trade[];
}
export interface ListTweetsResponse {
  tweets: Tweet[];
}

// Trade decisions (worker-internal)
export interface TradeDecisionDTO {
  agentId: string;
  tokenId: string;
  type: TradeType;
  amount: string;
}
