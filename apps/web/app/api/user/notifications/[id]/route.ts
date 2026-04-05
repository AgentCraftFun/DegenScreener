import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { requireAuth } from "../../../../../lib/api";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const [notif] = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.id, params.id));
  if (!notif) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (notif.userId !== auth.user.userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [updated] = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(eq(schema.notifications.id, params.id))
    .returning();
  return NextResponse.json({ notification: updated });
}
