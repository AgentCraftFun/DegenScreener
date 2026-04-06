import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { requireAuth, parsePagination } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const { limit, offset } = parsePagination(url);
  const rows = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, auth.user.userId))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(limit)
    .offset(offset);
  return NextResponse.json({ transactions: rows, page: { limit, offset } });
}
