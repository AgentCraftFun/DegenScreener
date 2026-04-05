import { Decimal } from "decimal.js";
import { sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { and, eq, gte } from "drizzle-orm";

function floorToMinute(d: Date): Date {
  const t = new Date(d);
  t.setUTCSeconds(0, 0);
  return t;
}

export async function aggregateCandlesForTick(tokenId: string) {
  const now = new Date();
  const minute = floorToMinute(now);

  const rows = await db
    .select({
      priceAtTrade: schema.trades.priceAtTrade,
      dscreenAmount: schema.trades.dscreenAmount,
      createdAt: schema.trades.createdAt,
    })
    .from(schema.trades)
    .where(
      and(
        eq(schema.trades.tokenId, tokenId),
        gte(schema.trades.createdAt, minute),
      ),
    );
  if (rows.length === 0) return;

  // Sort by createdAt asc
  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const prices = rows.map((r) => new Decimal(r.priceAtTrade));
  const open = prices[0]!;
  const close = prices[prices.length - 1]!;
  let high = prices[0]!;
  let low = prices[0]!;
  for (const p of prices) {
    if (p.gt(high)) high = p;
    if (p.lt(low)) low = p;
  }
  const volume = rows.reduce(
    (acc, r) => acc.add(new Decimal(r.dscreenAmount)),
    new Decimal(0),
  );

  await db
    .insert(schema.candles)
    .values({
      tokenId,
      timeframe: "1m",
      timestamp: minute,
      open: open.toFixed(18),
      high: high.toFixed(18),
      low: low.toFixed(18),
      close: close.toFixed(18),
      volume: volume.toFixed(18),
    })
    .onConflictDoUpdate({
      target: [schema.candles.tokenId, schema.candles.timeframe, schema.candles.timestamp],
      set: {
        open: open.toFixed(18),
        high: high.toFixed(18),
        low: low.toFixed(18),
        close: close.toFixed(18),
        volume: volume.toFixed(18),
      },
    });
}

// Keep sql import used
void sql;
