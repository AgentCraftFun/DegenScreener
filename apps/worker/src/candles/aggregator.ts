import { Decimal } from "decimal.js";
import { sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { and, eq, gte } from "drizzle-orm";
import type { TradeEvent, UniswapSwapEvent } from "@degenscreener/blockchain";

function floorToMinute(d: Date): Date {
  const t = new Date(d);
  t.setUTCSeconds(0, 0);
  return t;
}

/**
 * Aggregate candles from trades in the DB for the current minute (V1 + V2 DB trades).
 */
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

  await upsertCandle(tokenId, minute, open, high, low, close, volume);
}

/**
 * Process a bonding curve Trade event into a candle.
 * Called by the event indexer when a Trade event is received.
 */
export async function processBondingCurveTrade(
  event: TradeEvent,
  tokenId: string,
) {
  const price = new Decimal(event.price.toString()).div(new Decimal("1e18"));
  const ethAmount = new Decimal(event.ethAmount.toString()).div(new Decimal("1e18"));
  const minute = floorToMinute(new Date());

  await upsertCandleWithTrade(tokenId, minute, price, ethAmount);
}

/**
 * Process a Uniswap Swap event into a candle.
 * For Uniswap: compute price from swap amounts (token0/token1 ratio).
 */
export async function processUniswapSwap(
  event: UniswapSwapEvent,
  tokenId: string,
  tokenIsToken0: boolean,
) {
  // Determine price from swap amounts
  // If token is token0: price = eth_amount / token_amount
  // If token is token1: price = eth_amount / token_amount
  const amount0In = new Decimal(event.amount0In.toString());
  const amount1In = new Decimal(event.amount1In.toString());
  const amount0Out = new Decimal(event.amount0Out.toString());
  const amount1Out = new Decimal(event.amount1Out.toString());

  let ethAmount: Decimal;
  let tokenAmount: Decimal;

  if (tokenIsToken0) {
    // ETH is token1
    ethAmount = Decimal.max(amount1In, amount1Out);
    tokenAmount = Decimal.max(amount0In, amount0Out);
  } else {
    // ETH is token0
    ethAmount = Decimal.max(amount0In, amount0Out);
    tokenAmount = Decimal.max(amount1In, amount1Out);
  }

  if (tokenAmount.lte(0)) return;

  const price = ethAmount.div(tokenAmount).div(new Decimal("1e18"));
  const volume = ethAmount.div(new Decimal("1e18"));
  const minute = floorToMinute(new Date());

  await upsertCandleWithTrade(tokenId, minute, price, volume);
}

/**
 * Insert or update a candle with a single trade's data.
 * Handles merging with existing candle for the same minute.
 */
async function upsertCandleWithTrade(
  tokenId: string,
  minute: Date,
  price: Decimal,
  volume: Decimal,
) {
  // Try to fetch existing candle for this minute
  const existing = await db
    .select()
    .from(schema.candles)
    .where(
      and(
        eq(schema.candles.tokenId, tokenId),
        eq(schema.candles.timeframe, "1m"),
        eq(schema.candles.timestamp, minute),
      ),
    );

  if (existing.length > 0) {
    const candle = existing[0]!;
    const high = Decimal.max(new Decimal(candle.high), price);
    const low = Decimal.min(new Decimal(candle.low), price);
    const vol = new Decimal(candle.volume).add(volume);

    await db
      .update(schema.candles)
      .set({
        high: high.toFixed(18),
        low: low.toFixed(18),
        close: price.toFixed(18),
        volume: vol.toFixed(18),
      })
      .where(
        and(
          eq(schema.candles.tokenId, tokenId),
          eq(schema.candles.timeframe, "1m"),
          eq(schema.candles.timestamp, minute),
        ),
      );
  } else {
    await db.insert(schema.candles).values({
      tokenId,
      timeframe: "1m",
      timestamp: minute,
      open: price.toFixed(18),
      high: price.toFixed(18),
      low: price.toFixed(18),
      close: price.toFixed(18),
      volume: volume.toFixed(18),
    });
  }
}

/**
 * Full upsert for a complete candle (used by aggregateCandlesForTick).
 */
async function upsertCandle(
  tokenId: string,
  minute: Date,
  open: Decimal,
  high: Decimal,
  low: Decimal,
  close: Decimal,
  volume: Decimal,
) {
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
