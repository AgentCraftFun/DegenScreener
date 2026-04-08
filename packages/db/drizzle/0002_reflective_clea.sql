ALTER TABLE "agents" ADD COLUMN "tx_state" varchar(32) DEFAULT 'IDLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "last_tx_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "cooldown_until" timestamp with time zone;