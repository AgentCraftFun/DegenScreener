import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  text,
  index,
  uniqueIndex,
  check,
  serial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums
export const agentTypeEnum = pgEnum("agent_type", ["DEV", "DEGEN"]);
export const agentStatusEnum = pgEnum("agent_status", ["ACTIVE", "BROKE"]);
export const tokenStatusEnum = pgEnum("token_status", [
  "ACTIVE",
  "RUGGED",
  "DEAD",
]);
export const tradeTypeEnum = pgEnum("trade_type", ["BUY", "SELL"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "DEPOSIT",
  "WITHDRAWAL",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
]);

const MONEY = { precision: 36, scale: 18 } as const;
const K_CONST = { precision: 72, scale: 36 } as const;

// users
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    walletAddress: varchar("wallet_address", { length: 128 }).notNull(),
    internalBalance: numeric("internal_balance", MONEY).notNull().default("0"),
    totalDeposited: numeric("total_deposited", MONEY).notNull().default("0"),
    totalWithdrawn: numeric("total_withdrawn", MONEY).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActive: timestamp("last_active", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    walletIdx: uniqueIndex("users_wallet_address_idx").on(t.walletAddress),
    balanceNonNeg: check(
      "users_balance_non_negative",
      sql`${t.internalBalance} >= 0`,
    ),
  }),
);

// agents
export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    handle: varchar("handle", { length: 64 }).notNull(),
    type: agentTypeEnum("type").notNull(),
    balance: numeric("balance", MONEY).notNull().default("0"),
    status: agentStatusEnum("status").notNull().default("ACTIVE"),
    riskProfile: jsonb("risk_profile").notNull(),
    personality: varchar("personality", { length: 32 }).notNull(),
    totalPnl: numeric("total_pnl", MONEY).notNull().default("0"),
    totalVolume: numeric("total_volume", MONEY).notNull().default("0"),
    totalFeesEarned: numeric("total_fees_earned", MONEY).notNull().default("0"),
    tokensLaunched: integer("tokens_launched").notNull().default(0),
    rugCount: integer("rug_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    nextEvalTick: integer("next_eval_tick").notNull().default(0),
  },
  (t) => ({
    handleIdx: uniqueIndex("agents_handle_idx").on(t.handle),
    ownerIdx: index("agents_owner_idx").on(t.ownerId),
    balanceNonNeg: check("agents_balance_non_negative", sql`${t.balance} >= 0`),
  }),
);

// tokens
export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ticker: varchar("ticker", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    creatorAgentId: uuid("creator_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "restrict" }),
    totalSupply: numeric("total_supply", MONEY).notNull(),
    status: tokenStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tickerIdx: uniqueIndex("tokens_ticker_idx").on(t.ticker),
  }),
);

// liquidity_pools
export const liquidityPools = pgTable("liquidity_pools", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: uuid("token_id")
    .notNull()
    .references(() => tokens.id, { onDelete: "cascade" }),
  dscreenReserve: numeric("dscreen_reserve", MONEY).notNull(),
  tokenReserve: numeric("token_reserve", MONEY).notNull(),
  kConstant: numeric("k_constant", K_CONST).notNull(),
  totalVolume: numeric("total_volume", MONEY).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// trades
export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    type: tradeTypeEnum("type").notNull(),
    dscreenAmount: numeric("dscreen_amount", MONEY).notNull(),
    tokenAmount: numeric("token_amount", MONEY).notNull(),
    priceAtTrade: numeric("price_at_trade", MONEY).notNull(),
    feeAmount: numeric("fee_amount", MONEY).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    agentIdx: index("trades_agent_idx").on(t.agentId),
    tokenIdx: index("trades_token_idx").on(t.tokenId),
    createdIdx: index("trades_created_idx").on(t.createdAt),
  }),
);

// agent_holdings
export const agentHoldings = pgTable(
  "agent_holdings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", MONEY).notNull().default("0"),
    avgEntryPrice: numeric("avg_entry_price", MONEY).notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    agentTokenIdx: uniqueIndex("agent_holdings_agent_token_idx").on(
      t.agentId,
      t.tokenId,
    ),
    qtyNonNeg: check("holdings_quantity_non_negative", sql`${t.quantity} >= 0`),
  }),
);

// tweets
export const tweets = pgTable(
  "tweets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tokenId: uuid("token_id").references(() => tokens.id, {
      onDelete: "set null",
    }),
    sentimentScore: numeric("sentiment_score", { precision: 3, scale: 2 })
      .notNull()
      .default("0"),
    likes: integer("likes").notNull().default(0),
    retweets: integer("retweets").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    agentIdx: index("tweets_agent_idx").on(t.agentId),
    tokenIdx: index("tweets_token_idx").on(t.tokenId),
    createdIdx: index("tweets_created_idx").on(t.createdAt),
  }),
);

// candles (will be converted to TimescaleDB hypertable)
export const candles = pgTable(
  "candles",
  {
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    open: numeric("open", MONEY).notNull(),
    high: numeric("high", MONEY).notNull(),
    low: numeric("low", MONEY).notNull(),
    close: numeric("close", MONEY).notNull(),
    volume: numeric("volume", MONEY).notNull().default("0"),
  },
  (t) => ({
    composite: uniqueIndex("candles_token_tf_ts_idx").on(
      t.tokenId,
      t.timeframe,
      t.timestamp,
    ),
  }),
);

// transactions
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", MONEY).notNull(),
    fee: numeric("fee", MONEY).notNull(),
    netAmount: numeric("net_amount", MONEY).notNull(),
    txHash: varchar("tx_hash", { length: 128 }).notNull(),
    status: transactionStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("transactions_user_idx").on(t.userId),
    txHashIdx: index("transactions_tx_hash_idx").on(t.txHash),
  }),
);

// notifications
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

// simulation_state
export const simulationState = pgTable("simulation_state", {
  id: serial("id").primaryKey(),
  currentTick: bigint("current_tick", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  lastTickAt: timestamp("last_tick_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// agent_cost_tracking
export const agentCostTracking = pgTable(
  "agent_cost_tracking",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    hourBucket: timestamp("hour_bucket", { withTimezone: true }).notNull(),
    totalInputTokens: integer("total_input_tokens").notNull().default(0),
    totalOutputTokens: integer("total_output_tokens").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 10,
      scale: 6,
    })
      .notNull()
      .default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    agentHourIdx: uniqueIndex("agent_cost_agent_hour_idx").on(
      t.agentId,
      t.hourBucket,
    ),
  }),
);
