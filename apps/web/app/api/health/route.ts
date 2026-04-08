import { NextResponse } from "next/server";
import { db, schema } from "@degenscreener/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  // Check database connectivity
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
    healthy = false;
  }

  // Get basic stats
  let stats: Record<string, number> = {};
  try {
    const [agentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.agents);
    const [tokenCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.tokens);
    stats = {
      agents: agentCount?.count ?? 0,
      tokens: tokenCount?.count ?? 0,
    };
  } catch {
    // Non-critical — stats are optional
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      stats,
    },
    { status: healthy ? 200 : 503 },
  );
}
