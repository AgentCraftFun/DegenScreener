import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { transactions } from "../schema.js";

type NewTransaction = typeof transactions.$inferInsert;

export async function createTransaction(data: NewTransaction) {
  const [row] = await db.insert(transactions).values(data).returning();
  return row!;
}

export async function updateTransactionStatus(
  id: string,
  status: "PENDING" | "CONFIRMED" | "FAILED",
  confirmedAt?: Date,
) {
  const [row] = await db
    .update(transactions)
    .set({ status, ...(confirmedAt ? { confirmedAt } : {}) })
    .where(eq(transactions.id, id))
    .returning();
  return row!;
}

export async function getTransactionsByUser(userId: string, limit = 100) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}
