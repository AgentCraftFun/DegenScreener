import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { parsePagination } from "../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const { limit, offset } = parsePagination(url);
  const rows = await db
    .select()
    .from(schema.tweets)
    .where(eq(schema.tweets.agentId, params.id))
    .orderBy(desc(schema.tweets.createdAt))
    .limit(limit)
    .offset(offset);
  return NextResponse.json({ tweets: rows, page: { limit, offset } });
}
