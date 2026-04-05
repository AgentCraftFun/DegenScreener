import { eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { users } from "../schema.js";

export async function createUser(walletAddress: string) {
  const [row] = await db
    .insert(users)
    .values({ walletAddress })
    .returning();
  return row!;
}

export async function getUserByWallet(walletAddress: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress));
  return row ?? null;
}

export async function getUserById(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export async function updateBalance(userId: string, delta: string) {
  const [row] = await db
    .update(users)
    .set({
      internalBalance: sql`${users.internalBalance} + ${delta}`,
      lastActive: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return row!;
}
