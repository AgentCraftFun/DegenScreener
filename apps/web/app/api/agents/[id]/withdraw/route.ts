import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { MIN_WITHDRAWAL } from "@degenscreener/shared";
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
  if (amt.lt(MIN_WITHDRAWAL))
    return NextResponse.json({ error: `minimum withdrawal ${MIN_WITHDRAWAL}` }, { status: 400 });

  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, params.id));
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.ownerId !== auth.user.userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (new Decimal(agent.balance).lt(amt))
    return NextResponse.json({ error: "agent has insufficient balance" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [a] = await tx
      .update(schema.agents)
      .set({ balance: sql`${schema.agents.balance} - ${amt.toFixed(18)}` })
      .where(eq(schema.agents.id, agent.id))
      .returning();
    await tx
      .update(schema.users)
      .set({ internalBalance: sql`${schema.users.internalBalance} + ${amt.toFixed(18)}` })
      .where(eq(schema.users.id, auth.user.userId));
    // Check BROKE transition
    const remaining = new Decimal(a!.balance);
    if (remaining.lt("0.01")) {
      const holdings = await tx
        .select()
        .from(schema.agentHoldings)
        .where(eq(schema.agentHoldings.agentId, agent.id));
      const hasValue = holdings.some((h) => new Decimal(h.quantity).gt(0));
      if (!hasValue) {
        const [fin] = await tx
          .update(schema.agents)
          .set({ status: "BROKE" })
          .where(eq(schema.agents.id, agent.id))
          .returning();
        return fin!;
      }
    }
    return a!;
  });

  return NextResponse.json({ agent: updated });
}
