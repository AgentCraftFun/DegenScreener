import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { requireAuth, parseBody } from "../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ amount: z.string().regex(/^\d+(\.\d+)?$/) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const amt = new Decimal(parsed.data.amount);
  if (amt.lte(0)) return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });

  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, params.id));
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.ownerId !== auth.user.userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, auth.user.userId));
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (new Decimal(user.internalBalance).lt(amt))
    return NextResponse.json({ error: "insufficient balance" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({ internalBalance: sql`${schema.users.internalBalance} - ${amt.toFixed(18)}` })
      .where(eq(schema.users.id, user.id));
    const patch: Record<string, unknown> = {
      balance: sql`${schema.agents.balance} + ${amt.toFixed(18)}`,
    };
    if (agent.status === "BROKE") {
      patch.status = "ACTIVE";
      patch.nextEvalTick = 0;
    }
    const [a] = await tx
      .update(schema.agents)
      .set(patch)
      .where(eq(schema.agents.id, agent.id))
      .returning();
    return a;
  });

  return NextResponse.json({ agent: updated });
}
