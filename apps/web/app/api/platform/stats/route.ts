import { NextResponse } from "next/server";
import { and, eq, gte, count, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";

export async function GET() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalVol] = await db
    .select({ v: sql<string>`COALESCE(SUM(${schema.trades.dscreenAmount}),0)` })
    .from(schema.trades);
  const [totalAgents] = await db.select({ c: count() }).from(schema.agents);
  const [totalLaunched] = await db.select({ c: count() }).from(schema.tokens);
  const [totalRugged] = await db
    .select({ c: count() })
    .from(schema.tokens)
    .where(eq(schema.tokens.status, "RUGGED"));
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
  return NextResponse.json({
    totalVolume: totalVol?.v ?? "0",
    totalAgents: totalAgents?.c ?? 0,
    totalTokensLaunched: totalLaunched?.c ?? 0,
    totalTokensRugged: totalRugged?.c ?? 0,
    totalDscreenDeposited: totalDep?.v ?? "0",
    totalDscreenWithdrawn: totalWd?.v ?? "0",
    activeAgents24h: Number(active24h?.c ?? 0),
  });
}
