import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { eq, and, gte, sql, count } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import {
  WITHDRAWAL_FEE_RATE,
  MIN_WITHDRAWAL,
  MAX_WITHDRAWALS_PER_DAY,
} from "@degenscreener/shared";
import { requireAuth, parseBody, checkRateLimit } from "../../../../lib/api";

export const runtime = "nodejs";

const BodySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const rl = await checkRateLimit(req, "money", auth.user.userId);
  if (rl) return rl;
  const parsed = await parseBody(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const amt = new Decimal(parsed.data.amount);
  if (amt.lt(MIN_WITHDRAWAL))
    return NextResponse.json({ error: `minimum withdrawal ${MIN_WITHDRAWAL}` }, { status: 400 });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [cnt] = await db
    .select({ c: count() })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, auth.user.userId),
        eq(schema.transactions.type, "WITHDRAWAL"),
        gte(schema.transactions.createdAt, dayAgo),
      ),
    );
  if ((cnt?.c ?? 0) >= MAX_WITHDRAWALS_PER_DAY)
    return NextResponse.json(
      { error: `max ${MAX_WITHDRAWALS_PER_DAY} withdrawals per 24h` },
      { status: 429 },
    );

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, auth.user.userId));
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (new Decimal(user.internalBalance).lt(amt))
    return NextResponse.json({ error: "insufficient balance" }, { status: 400 });

  const fee = amt.mul(WITHDRAWAL_FEE_RATE);
  const net = amt.sub(fee);

  const tx = await db.transaction(async (trx) => {
    await trx
      .update(schema.users)
      .set({
        internalBalance: sql`${schema.users.internalBalance} - ${amt.toFixed(18)}`,
        totalWithdrawn: sql`${schema.users.totalWithdrawn} + ${amt.toFixed(18)}`,
      })
      .where(eq(schema.users.id, auth.user.userId));
    const [txRow] = await trx
      .insert(schema.transactions)
      .values({
        userId: auth.user.userId,
        type: "WITHDRAWAL",
        amount: amt.toFixed(18),
        fee: fee.toFixed(18),
        netAmount: net.toFixed(18),
        txHash: "0x" + "0".repeat(64),
        status: "CONFIRMED",
        confirmedAt: new Date(),
      })
      .returning();
    void parsed.data.toAddress;
    return txRow;
  });

  return NextResponse.json({ transaction: tx });
}
