import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { getAuthFromRequest } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthFromRequest(req);
  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, params.id));
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [trades, tweets, holdings] = await Promise.all([
    db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.agentId, agent.id))
      .orderBy(desc(schema.trades.createdAt))
      .limit(10),
    db
      .select()
      .from(schema.tweets)
      .where(eq(schema.tweets.agentId, agent.id))
      .orderBy(desc(schema.tweets.createdAt))
      .limit(10),
    agent.type === "DEGEN"
      ? db
          .select()
          .from(schema.agentHoldings)
          .where(eq(schema.agentHoldings.agentId, agent.id))
      : Promise.resolve([]),
  ]);

  const ownerMatches = auth?.userId === agent.ownerId;
  const payload = ownerMatches
    ? agent
    : (() => {
        const { balance: _b, ...rest } = agent;
        void _b;
        return rest;
      })();

  return NextResponse.json({
    agent: payload,
    trades,
    tweets,
    holdings,
  });
}
