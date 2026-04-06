import { NextResponse } from "next/server";
import { and, eq, desc, count } from "drizzle-orm";
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
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, auth.user.userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const [unread] = await db
    .select({ c: count() })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, auth.user.userId),
        eq(schema.notifications.read, false),
      ),
    );

  return NextResponse.json({
    notifications: rows,
    unreadCount: unread?.c ?? 0,
    page: { limit, offset },
  });
}
