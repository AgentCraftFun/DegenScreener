CREATE TYPE "public"."agent_status" AS ENUM('ACTIVE', 'BROKE');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('DEV', 'DEGEN');--> statement-breakpoint
CREATE TYPE "public"."token_status" AS ENUM('ACTIVE', 'RUGGED', 'DEAD');--> statement-breakpoint
CREATE TYPE "public"."trade_type" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'CONFIRMED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'WITHDRAWAL');--> statement-breakpoint
CREATE TABLE "agent_cost_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"hour_bucket" timestamp with time zone NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"token_id" uuid NOT NULL,
	"quantity" numeric(36, 18) DEFAULT '0' NOT NULL,
	"avg_entry_price" numeric(36, 18) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_quantity_non_negative" CHECK ("agent_holdings"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"handle" varchar(64) NOT NULL,
	"type" "agent_type" NOT NULL,
	"balance" numeric(36, 18) DEFAULT '0' NOT NULL,
	"status" "agent_status" DEFAULT 'ACTIVE' NOT NULL,
	"risk_profile" jsonb NOT NULL,
	"personality" varchar(32) NOT NULL,
	"total_pnl" numeric(36, 18) DEFAULT '0' NOT NULL,
	"total_volume" numeric(36, 18) DEFAULT '0' NOT NULL,
	"total_fees_earned" numeric(36, 18) DEFAULT '0' NOT NULL,
	"tokens_launched" integer DEFAULT 0 NOT NULL,
	"rug_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"avatar_url" varchar(512),
	"next_eval_tick" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "agents_balance_non_negative" CHECK ("agents"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "candles" (
	"token_id" uuid NOT NULL,
	"timeframe" varchar(8) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"open" numeric(36, 18) NOT NULL,
	"high" numeric(36, 18) NOT NULL,
	"low" numeric(36, 18) NOT NULL,
	"close" numeric(36, 18) NOT NULL,
	"volume" numeric(36, 18) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidity_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"dscreen_reserve" numeric(36, 18) NOT NULL,
	"token_reserve" numeric(36, 18) NOT NULL,
	"k_constant" numeric(72, 36) NOT NULL,
	"total_volume" numeric(36, 18) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(256) NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_tick" bigint DEFAULT 0 NOT NULL,
	"last_tick_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"creator_agent_id" uuid NOT NULL,
	"total_supply" numeric(36, 18) NOT NULL,
	"status" "token_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"token_id" uuid NOT NULL,
	"type" "trade_type" NOT NULL,
	"dscreen_amount" numeric(36, 18) NOT NULL,
	"token_amount" numeric(36, 18) NOT NULL,
	"price_at_trade" numeric(36, 18) NOT NULL,
	"fee_amount" numeric(36, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(36, 18) NOT NULL,
	"fee" numeric(36, 18) NOT NULL,
	"net_amount" numeric(36, 18) NOT NULL,
	"tx_hash" varchar(128) NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tweets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"content" text NOT NULL,
	"token_id" uuid,
	"sentiment_score" numeric(3, 2) DEFAULT '0' NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"retweets" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(128) NOT NULL,
	"internal_balance" numeric(36, 18) DEFAULT '0' NOT NULL,
	"total_deposited" numeric(36, 18) DEFAULT '0' NOT NULL,
	"total_withdrawn" numeric(36, 18) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_balance_non_negative" CHECK ("users"."internal_balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "agent_cost_tracking" ADD CONSTRAINT "agent_cost_tracking_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_holdings" ADD CONSTRAINT "agent_holdings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_holdings" ADD CONSTRAINT "agent_holdings_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candles" ADD CONSTRAINT "candles_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_creator_agent_id_agents_id_fk" FOREIGN KEY ("creator_agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_cost_agent_hour_idx" ON "agent_cost_tracking" USING btree ("agent_id","hour_bucket");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_holdings_agent_token_idx" ON "agent_holdings" USING btree ("agent_id","token_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_handle_idx" ON "agents" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "agents_owner_idx" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candles_token_tf_ts_idx" ON "candles" USING btree ("token_id","timeframe","timestamp");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tokens_ticker_idx" ON "tokens" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "trades_agent_idx" ON "trades" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "trades_token_idx" ON "trades" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "trades_created_idx" ON "trades" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_tx_hash_idx" ON "transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "tweets_agent_idx" ON "tweets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "tweets_token_idx" ON "tweets" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "tweets_created_idx" ON "tweets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_address_idx" ON "users" USING btree ("wallet_address");