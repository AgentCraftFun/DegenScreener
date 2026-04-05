import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";

function timeframeToMs(tf: string): number | null {
  switch (tf) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tf = url.searchParams.get("timeframe") ?? "all";

  if (tf === "all") {
    const rows = await db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.type, "DEGEN"))
      .orderBy(desc(schema.agents.totalPnl))
      .limit(100);
    return NextResponse.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        id: r.id,
        name: r.name,
        handle: r.handle,
        pnl: r.totalPnl,
        totalVolume: r.totalVolume,
        avatarUrl: r.avatarUrl,
      })),
    });
  }

  const ms = timeframeToMs(tf);
  if (!ms)
    return NextResponse.json({ error: "invalid timeframe" }, { status: 400 });
  const since = new Date(Date.now() - ms);

  // Aggregate trades within window per agent
  const agents = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.type, "DEGEN"));

  const tradeAgg = await db
    .select({
      agentId: schema.trades.agentId,
      count: sql<number>`COUNT(*)`,
      volume: sql<string>`SUM(${schema.trades.dscreenAmount})`,
    })
    .from(schema.trades)
    .where(gte(schema.trades.createdAt, since))
    .groupBy(schema.trades.agentId);
  const aggMap = new Map(
    tradeAgg.map((t) => [
      t.agentId,
      { count: Number(t.count), volume: t.volume ?? "0" },
    ]),
  );

  const ranked = agents
    .map((a) => {
      const agg = aggMap.get(a.id) ?? { count: 0, volume: "0" };
      return {
        id: a.id,
        name: a.name,
        handle: a.handle,
        pnl: a.totalPnl,
        totalVolume: agg.volume,
        tradesInWindow: agg.count,
        avatarUrl: a.avatarUrl,
      };
    })
    .sort((a, b) => new Decimal(b.pnl).sub(a.pnl).toNumber())
    .slice(0, 100)
    .map((x, i) => ({ rank: i + 1, ...x }));

  void and;
  return NextResponse.json({ leaderboard: ranked });
}
