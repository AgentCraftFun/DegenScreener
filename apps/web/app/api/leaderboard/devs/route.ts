import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";

export async function GET(_req: Request) {
  const rows = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.type, "DEV"))
    .orderBy(desc(schema.agents.totalFeesEarned))
    .limit(100);

  return NextResponse.json({
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.name,
      handle: r.handle,
      feesEarned: r.totalFeesEarned,
      volumeGenerated: r.totalVolume,
      tokensLaunched: r.tokensLaunched,
      rugCount: r.rugCount,
      avatarUrl: r.avatarUrl,
    })),
  });
}
