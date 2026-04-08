import { eq, and, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { pendingTransactions } from "../schema.js";

type NewPendingTx = typeof pendingTransactions.$inferInsert;

export async function createPendingTx(data: NewPendingTx) {
  const [row] = await db.insert(pendingTransactions).values(data).returning();
  return row!;
}

export async function updateTxStatus(
  id: string,
  update: Partial<typeof pendingTransactions.$inferInsert>,
) {
  const [row] = await db
    .update(pendingTransactions)
    .set(update)
    .where(eq(pendingTransactions.id, id))
    .returning();
  return row ?? null;
}

export async function getPendingByAgent(agentId: string) {
  return db
    .select()
    .from(pendingTransactions)
    .where(
      and(
        eq(pendingTransactions.agentId, agentId),
        inArray(pendingTransactions.status, ["QUEUED", "SUBMITTED"]),
      ),
    );
}

export async function getUnconfirmedTxs() {
  return db
    .select()
    .from(pendingTransactions)
    .where(eq(pendingTransactions.status, "SUBMITTED"));
}

export async function getTxByHash(txHash: string) {
  const [row] = await db
    .select()
    .from(pendingTransactions)
    .where(eq(pendingTransactions.txHash, txHash));
  return row ?? null;
}
