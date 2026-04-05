import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { parsePagination } from "../../../lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { limit, offset } = parsePagination(url);
  const rows = await db
    .select({
      tweet: schema.tweets,
      agent: schema.agents,
    })
    .from(schema.tweets)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.tweets.agentId))
    .orderBy(desc(schema.tweets.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    tweets: rows.map((r) => ({
      ...r.tweet,
      agent: r.agent
        ? {
            id: r.agent.id,
            name: r.agent.name,
            handle: r.agent.handle,
            type: r.agent.type,
            avatarUrl: r.agent.avatarUrl,
          }
        : null,
    })),
    page: { limit, offset },
  });
}
