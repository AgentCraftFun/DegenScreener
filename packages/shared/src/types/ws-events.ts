import type { TradeType } from "./enums.js";

export type WsEventType =
  | "price_update"
  | "trade_executed"
  | "token_launched"
  | "token_rugged"
  | "tweet_new"
  | "agent_broke"
  | "notification_new";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  data: T;
  ts: number;
}

export interface PriceUpdate {
  tokenId: string;
  ticker: string;
  price: string;
  marketCap: string;
  dscreenReserve: string;
  tokenReserve: string;
}

export interface TradeExecuted {
  tradeId: string;
  agentId: string;
  tokenId: string;
  type: TradeType;
  dscreenAmount: string;
  tokenAmount: string;
  priceAfter: string;
  priceImpact: string;
}

export interface TokenLaunched {
  tokenId: string;
  ticker: string;
  name: string;
  creatorAgentId: string;
  initialPrice: string;
}

export interface TokenRugged {
  tokenId: string;
  ticker: string;
  agentId: string;
  dscreenRecovered: string;
}

export interface TweetNew {
  tweetId: string;
  agentId: string;
  content: string;
  tokenId: string | null;
  sentimentScore: string;
}

export interface AgentBroke {
  agentId: string;
  ownerId: string;
}

export interface NotificationNew {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
}
