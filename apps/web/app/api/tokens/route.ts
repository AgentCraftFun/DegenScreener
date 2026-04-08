import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";
import { eq, desc, asc, sql, gte, and } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { parsePagination } from "../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const order = url.searchParams.get("order") ?? "desc";
  const phase = url.searchParams.get("phase"); // pre_bond | graduated | all
  const { limit, offset } = parsePagination(url);

  // Join tokens with pools
  const base = db
    .select({
      token: schema.tokens,
      pool: schema.liquidityPools,
      creator: schema.agents,
    })
    .from(schema.tokens)
    .leftJoin(
      schema.liquidityPools,
      eq(schema.liquidityPools.tokenId, schema.tokens.id),
    )
    .leftJoin(schema.agents, eq(schema.agents.id, schema.tokens.creatorAgentId));

  // Build where conditions
  const conditions = [];
  if (filter === "rugged") {
    conditions.push(eq(schema.tokens.status, "RUGGED"));
  } else if (filter === "graduated") {
    conditions.push(eq(schema.tokens.phase, "GRADUATED"));
  } else {
    conditions.push(eq(schema.tokens.status, "ACTIVE"));
  }

  // Phase filter
  if (phase === "pre_bond") {
    conditions.push(eq(schema.tokens.phase, "PRE_BOND"));
  } else if (phase === "graduated") {
    conditions.push(eq(schema.tokens.phase, "GRADUATED"));
  }

  let query: typeof base;
  if (conditions.length > 1) {
    query = base.where(and(...conditions)) as typeof base;
  } else {
    query = base.where(conditions[0]!) as typeof base;
  }

  const rows = await query.limit(500);

  // Calculate 24h volume for each token
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const volumeRows = await db
    .select({
      tokenId: schema.trades.tokenId,
      vol: sql<string>`SUM(${schema.trades.dscreenAmount})`,
    })
    .from(schema.trades)
    .where(gte(schema.trades.createdAt, dayAgo))
    .groupBy(schema.trades.tokenId);
  const volMap = new Map(volumeRows.map((v) => [v.tokenId, v.vol ?? "0"]));

  // Calculate 24h price change from candles
  const openRows = await db
    .select({
      tokenId: schema.candles.tokenId,
      open: schema.candles.open,
      timestamp: schema.candles.timestamp,
    })
    .from(schema.candles)
    .where(gte(schema.candles.timestamp, dayAgo));
  const openMap = new Map<string, { open: string; ts: Date }>();
  for (const r of openRows) {
    const cur = openMap.get(r.tokenId);
    if (!cur || r.timestamp < cur.ts) {
      openMap.set(r.tokenId, { open: r.open, ts: r.timestamp });
    }
  }

  let enriched = rows.map(({ token, pool, creator }) => {
    const tr = pool ? new Decimal(pool.tokenReserve) : new Decimal(0);
    const price =
      pool && tr.gt(0)
        ? new Decimal(pool.dscreenReserve).div(tr)
        : new Decimal(0);
    const mc = price.mul(token.totalSupply);
    const vol24h = volMap.get(token.id) ?? "0";
    const openInfo = openMap.get(token.id);
    const change24h =
      openInfo && new Decimal(openInfo.open).gt(0)
        ? price
            .sub(openInfo.open)
            .div(openInfo.open)
            .mul(100)
            .toFixed(2)
        : "0";
    // Graduation progress: estimate from initial liquidity if available
    let graduationProgress = "0";
    if (token.phase === "GRADUATED") {
      graduationProgress = "100.00";
    } else if (token.initialLiquidityEth && new Decimal(token.initialLiquidityEth).gt(0)) {
      // Rough estimate: initialLiquidityEth / typical threshold (4 ETH)
      const threshold = new Decimal("4");
      const pct = new Decimal(token.initialLiquidityEth).div(threshold).mul(100);
      graduationProgress = Decimal.min(pct, new Decimal(100)).toFixed(2);
    }

    return {
      id: token.id,
      ticker: token.ticker,
      name: token.name,
      status: token.status,
      createdAt: token.createdAt,
      price: price.toFixed(18),
      marketCap: mc.toFixed(6),
      volume24h: vol24h,
      change24hPct: change24h,
      creator: creator
        ? { id: creator.id, name: creator.name, handle: creator.handle }
        : null,
      contractAddress: token.contractAddress,
      phase: token.phase,
      graduationProgress,
      uniswapPairAddress: token.uniswapPairAddress,
    };
  });

  // Sort based on filter
  if (filter === "new") {
    enriched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (filter === "trending") {
    enriched.sort((a, b) => Number(b.volume24h) - Number(a.volume24h));
  } else if (filter === "gainers") {
    enriched.sort((a, b) => Number(b.change24hPct) - Number(a.change24hPct));
  } else if (filter === "losers") {
    enriched.sort((a, b) => Number(a.change24hPct) - Number(b.change24hPct));
  } else if (filter === "graduated") {
    enriched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  if (order === "asc") enriched.reverse();

  enriched = enriched.slice(offset, offset + limit);

  return NextResponse.json({ tokens: enriched, page: { limit, offset } });
}
// Avoid unused import warnings
void desc;
void asc;
