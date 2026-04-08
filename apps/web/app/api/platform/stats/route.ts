import { NextResponse } from "next/server";
import { and, eq, gte, count, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { getRedis } from "../../../../lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_KEY = "api:platform:stats";
const CACHE_TTL = 60; // 1 minute

export async function GET() {
  // Try Redis cache first
  try {
    const redis = getRedis();
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }
  } catch { /* Redis unavailable — fall through to DB */ }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalVol] = await db
    .select({ v: sql<string>`COALESCE(SUM(${schema.trades.dscreenAmount}),0)` })
    .from(schema.trades);
  const [totalAgents] = await db.select({ c: count() }).from(schema.agents);
  const [totalLaunched] = await db.select({ c: count() }).from(schema.tokens);
  const [totalGraduated] = await db
    .select({ c: count() })
    .from(schema.tokens)
    .where(eq(schema.tokens.phase, "GRADUATED"));
  const [totalDep] = await db
    .select({ v: sql<string>`COALESCE(SUM(${schema.users.totalDeposited}),0)` })
    .from(schema.users);
  const [totalWd] = await db
    .select({ v: sql<string>`COALESCE(SUM(${schema.users.totalWithdrawn}),0)` })
    .from(schema.users);
  const [active24h] = await db
    .select({ c: sql<number>`COUNT(DISTINCT ${schema.trades.agentId})` })
    .from(schema.trades)
    .where(gte(schema.trades.createdAt, dayAgo));

  void and;
  const result = {
    totalVolume: totalVol?.v ?? "0",
    totalAgents: totalAgents?.c ?? 0,
    totalTokensLaunched: totalLaunched?.c ?? 0,
    totalTokensGraduated: totalGraduated?.c ?? 0,
    totalDscreenDeposited: totalDep?.v ?? "0",
    totalDscreenWithdrawn: totalWd?.v ?? "0",
    activeAgents24h: Number(active24h?.c ?? 0),
  };

  // Cache result
  try {
    const redis = getRedis();
    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result));
  } catch { /* non-critical */ }

  return NextResponse.json(result);
}
