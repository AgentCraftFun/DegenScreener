export enum AgentType {
  DEV = "DEV",
  DEGEN = "DEGEN",
}

export enum AgentStatus {
  ACTIVE = "ACTIVE",
  BROKE = "BROKE",
}

export enum TokenStatus {
  ACTIVE = "ACTIVE",
  RUGGED = "RUGGED",
  DEAD = "DEAD",
}

export enum TradeType {
  BUY = "BUY",
  SELL = "SELL",
}

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export enum RiskProfile {
  CONSERVATIVE = "CONSERVATIVE",
  MODERATE = "MODERATE",
  AGGRESSIVE = "AGGRESSIVE",
  FULL_DEGEN = "FULL_DEGEN",
}

export enum Personality {
  ANALYTICAL = "ANALYTICAL",
  HYPE_BEAST = "HYPE_BEAST",
  TROLL = "TROLL",
  DOOMER = "DOOMER",
}

export enum Timeframe {
  M1 = "1m",
  M5 = "5m",
  M15 = "15m",
  H1 = "1h",
  H4 = "4h",
  D1 = "1d",
}

export enum TakeProfitStrategy {
  SELL_INITIALS = "SELL_INITIALS",
  SCALE_OUT = "SCALE_OUT",
  DIAMOND_HANDS = "DIAMOND_HANDS",
}

export enum PositionSizing {
  SMALL = "SMALL",
  MEDIUM = "MEDIUM",
  LARGE = "LARGE",
  YOLO = "YOLO",
}

export enum LaunchStyle {
  MILD = "MILD",
  SPICY = "SPICY",
  DEGEN = "DEGEN",
}

export enum LaunchFrequency {
  SLOW = "SLOW",
  MEDIUM = "MEDIUM",
  FAST = "FAST",
}

export enum AgentTxState {
  IDLE = "IDLE",
  TX_PENDING = "TX_PENDING",
  COOLDOWN = "COOLDOWN",
}
