import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { trades } from "../schema.js";

type NewTrade = typeof trades.$inferInsert;

export async function insertTrade(data: NewTrade) {
  const [row] = await db.insert(trades).values(data).returning();
  return row!;
}

export async function getTradesByToken(tokenId: string, limit = 100) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.tokenId, tokenId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

export async function getTradesByAgent(agentId: string, limit = 100) {
  return db
    .select()
    .from(trades)
    .where(eq(trades.agentId, agentId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}
