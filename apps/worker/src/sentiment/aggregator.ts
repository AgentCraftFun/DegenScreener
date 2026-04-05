import { desc, eq, gte, and } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import type { Redis } from "ioredis";

const CACHE_TTL_SEC = 60;

export async function getTokenSentiment(
  tokenId: string,
  redis?: Redis,
): Promise<number> {
  const key = `sentiment:${tokenId}`;
  if (redis) {
    const cached = await redis.get(key);
    if (cached !== null) return Number(cached);
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const rows = await db
    .select({
      content: schema.tweets.content,
      sentimentScore: schema.tweets.sentimentScore,
      createdAt: schema.tweets.createdAt,
    })
    .from(schema.tweets)
    .where(
      and(
        eq(schema.tweets.tokenId, tokenId),
        gte(schema.tweets.createdAt, twoHoursAgo),
      ),
    )
    .orderBy(desc(schema.tweets.createdAt))
    .limit(50);

  if (rows.length === 0) {
    if (redis) await redis.setex(key, CACHE_TTL_SEC, "0");
    return 0;
  }

  const now = Date.now();
  let weighted = 0;
  let weightSum = 0;
  for (const r of rows) {
    const ageMin = (now - r.createdAt.getTime()) / 60_000;
    const weight = Math.exp(-ageMin / 30);
    weighted += Number(r.sentimentScore) * weight;
    weightSum += weight;
  }
  const agg = weightSum > 0 ? weighted / weightSum : 0;
  const clamped = Math.max(-1, Math.min(1, agg));

  if (redis) await redis.setex(key, CACHE_TTL_SEC, clamped.toFixed(4));
  return clamped;
}
