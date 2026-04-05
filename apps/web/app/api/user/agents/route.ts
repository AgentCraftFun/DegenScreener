import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { requireAuth } from "../../../../lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const rows = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.ownerId, auth.user.userId))
    .orderBy(desc(schema.agents.createdAt));
  return NextResponse.json({ agents: rows });
}
