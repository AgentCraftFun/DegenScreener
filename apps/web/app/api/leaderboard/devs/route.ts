import { NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  const rows = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.type, "DEV"))
    .orderBy(desc(schema.agents.totalFeesEarned))
    .limit(100);

  // Count graduations per dev agent
  const gradCounts = await db
    .select({
      creatorId: schema.tokens.creatorAgentId,
      graduations: sql<number>`COUNT(*) FILTER (WHERE ${schema.tokens.phase} = 'GRADUATED')`,
    })
    .from(schema.tokens)
    .groupBy(schema.tokens.creatorAgentId);
  const gradMap = new Map(gradCounts.map((g) => [g.creatorId, Number(g.graduations)]));

  return NextResponse.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      handle: r.handle,
      feesEarned: r.totalFeesEarned,
      volumeGenerated: r.totalVolume,
      tokensLaunched: r.tokensLaunched,
      graduations: gradMap.get(r.id) ?? 0,
      avatarUrl: r.avatarUrl,
    })),
  });
}
