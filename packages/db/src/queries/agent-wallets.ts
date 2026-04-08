import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { agentWallets } from "../schema.js";

type NewWallet = typeof agentWallets.$inferInsert;

export async function createWallet(data: NewWallet) {
  const [row] = await db.insert(agentWallets).values(data).returning();
  return row!;
}

export async function getWalletByAgentId(agentId: string) {
  const [row] = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.agentId, agentId));
  return row ?? null;
}

export async function getWalletByAddress(address: string) {
  const [row] = await db
    .select()
    .from(agentWallets)
    .where(eq(agentWallets.address, address));
  return row ?? null;
}

export async function updateBalance(agentId: string, balance: string) {
  const [row] = await db
    .update(agentWallets)
    .set({ ethBalance: balance })
    .where(eq(agentWallets.agentId, agentId))
    .returning();
  return row ?? null;
}
