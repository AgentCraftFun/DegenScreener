import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client.js";
import { candles } from "../schema.js";

type NewCandle = typeof candles.$inferInsert;

export async function upsertCandle(data: NewCandle) {
  await db
    .insert(candles)
    .values(data)
    .onConflictDoUpdate({
      target: [candles.tokenId, candles.timeframe, candles.timestamp],
      set: {
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume ?? "0",
      },
    });
}

export async function getCandlesByTokenAndTimeframe(
  tokenId: string,
  timeframe: string,
  since?: Date,
  limit = 500,
) {
  const cond = since
    ? and(
        eq(candles.tokenId, tokenId),
        eq(candles.timeframe, timeframe),
        gte(candles.timestamp, since),
      )
    : and(eq(candles.tokenId, tokenId), eq(candles.timeframe, timeframe));
  return db
    .select()
    .from(candles)
    .where(cond)
    .orderBy(asc(candles.timestamp))
    .limit(limit);
}
