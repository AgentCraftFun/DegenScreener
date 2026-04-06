import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { DEPOSIT_FEE_RATE, MIN_DEPOSIT } from "@degenscreener/shared";
import { requireAuth, parseBody, checkRateLimit } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const rl = await checkRateLimit(req, "money", auth.user.userId);
  if (rl) return rl;
  const parsed = await parseBody(req, BodySchema);
  if (!parsed.ok) return parsed.response;
  const amt = new Decimal(parsed.data.amount);
  if (amt.lt(MIN_DEPOSIT))
    return NextResponse.json({ error: `minimum deposit ${MIN_DEPOSIT}` }, { status: 400 });

  const fee = amt.mul(DEPOSIT_FEE_RATE);
  const net = amt.sub(fee);

  const tx = await db.transaction(async (trx) => {
    const [txRow] = await trx
      .insert(schema.transactions)
      .values({
        userId: auth.user.userId,
        type: "DEPOSIT",
        amount: amt.toFixed(18),
        fee: fee.toFixed(18),
        netAmount: net.toFixed(18),
        txHash: parsed.data.txHash,
        status: "PENDING",
      })
      .returning();
    // For now, credit immediately for testing
    await trx
      .update(schema.users)
      .set({
        internalBalance: sql`${schema.users.internalBalance} + ${net.toFixed(18)}`,
        totalDeposited: sql`${schema.users.totalDeposited} + ${amt.toFixed(18)}`,
      })
      .where(eq(schema.users.id, auth.user.userId));
    return txRow;
  });

  return NextResponse.json({ transaction: tx });
}
