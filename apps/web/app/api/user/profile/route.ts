import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { requireAuth } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, auth.user.userId));
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [c] = await db
    .select({ c: count() })
    .from(schema.agents)
    .where(eq(schema.agents.ownerId, user.id));
  return NextResponse.json({ user, agentCount: c?.c ?? 0 });
}
