import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { tweets } from "../schema.js";

type NewTweet = typeof tweets.$inferInsert;

export async function insertTweet(data: NewTweet) {
  const [row] = await db.insert(tweets).values(data).returning();
  return row!;
}

export async function getTweetsByAgent(agentId: string, limit = 50) {
  return db
    .select()
    .from(tweets)
    .where(eq(tweets.agentId, agentId))
    .orderBy(desc(tweets.createdAt))
    .limit(limit);
}

export async function getTweetsByToken(tokenId: string, limit = 50) {
  return db
    .select()
    .from(tweets)
    .where(eq(tweets.tokenId, tokenId))
    .orderBy(desc(tweets.createdAt))
    .limit(limit);
}

export async function getGlobalFeed(limit = 100) {
  return db.select().from(tweets).orderBy(desc(tweets.createdAt)).limit(limit);
}
