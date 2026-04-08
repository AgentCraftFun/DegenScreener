CREATE TABLE "agent_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"address" varchar(128) NOT NULL,
	"encrypted_private_key" text NOT NULL,
	"eth_balance" numeric(36, 18) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"headline" text NOT NULL,
	"source" varchar(128) NOT NULL,
	"url" text,
	"category" varchar(64),
	"sentiment" numeric(3, 2) DEFAULT '0',
	"topic_id" uuid,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"tx_hash" varchar(128),
	"status" varchar(32) DEFAULT 'QUEUED' NOT NULL,
	"tx_data" jsonb NOT NULL,
	"gas_used" numeric(18, 0),
	"gas_cost_eth" numeric(36, 18),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"block_number" bigint
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"memability_score" numeric(3, 1) NOT NULL,
	"velocity" varchar(32) NOT NULL,
	"source_count" integer DEFAULT 1 NOT NULL,
	"age_minutes" integer DEFAULT 0 NOT NULL,
	"already_launched" boolean DEFAULT false NOT NULL,
	"launched_token_id" uuid,
	"suggested_tickers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "wallet_address" varchar(128);--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "eth_balance" numeric(36, 18) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "contract_address" varchar(128);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "phase" varchar(32) DEFAULT 'PRE_BOND' NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "graduation_tx_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "uniswap_pair_address" varchar(128);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "graduated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "initial_liquidity_eth" numeric(36, 18);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "topic_id" uuid;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "tx_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "source" varchar(32) DEFAULT 'SIMULATION' NOT NULL;--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "gas_used" numeric(18, 0);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "gas_cost_eth" numeric(36, 18);--> statement-breakpoint
ALTER TABLE "trades" ADD COLUMN "block_number" bigint;--> statement-breakpoint
ALTER TABLE "agent_wallets" ADD CONSTRAINT "agent_wallets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_topic_id_trending_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."trending_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trending_topics" ADD CONSTRAINT "trending_topics_launched_token_id_tokens_id_fk" FOREIGN KEY ("launched_token_id") REFERENCES "public"."tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_wallets_agent_id_idx" ON "agent_wallets" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_wallets_address_idx" ON "agent_wallets" USING btree ("address");--> statement-breakpoint
CREATE INDEX "news_items_topic_idx" ON "news_items" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "news_items_fetched_idx" ON "news_items" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "pending_tx_agent_idx" ON "pending_transactions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "pending_tx_status_idx" ON "pending_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_tx_hash_idx" ON "pending_transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "trending_topics_topic_idx" ON "trending_topics" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "trending_topics_category_idx" ON "trending_topics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tokens_contract_address_idx" ON "tokens" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "trades_tx_hash_idx" ON "trades" USING btree ("tx_hash");