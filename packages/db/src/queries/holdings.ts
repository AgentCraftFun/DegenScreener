import { eq, and } from "drizzle-orm";
import { db } from "../client.js";
import { agentHoldings } from "../schema.js";

type NewHolding = typeof agentHoldings.$inferInsert;

export async function upsertHolding(data: NewHolding) {
  const [row] = await db
    .insert(agentHoldings)
    .values(data)
    .onConflictDoUpdate({
      target: [agentHoldings.agentId, agentHoldings.tokenId],
      set: {
        quantity: data.quantity!,
        avgEntryPrice: data.avgEntryPrice!,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function getHoldingsByAgent(agentId: string) {
  return db
    .select()
    .from(agentHoldings)
    .where(eq(agentHoldings.agentId, agentId));
}

export async function getHoldingByAgentAndToken(
  agentId: string,
  tokenId: string,
) {
  const [row] = await db
    .select()
    .from(agentHoldings)
    .where(
      and(
        eq(agentHoldings.agentId, agentId),
        eq(agentHoldings.tokenId, tokenId),
      ),
    );
  return row ?? null;
}

export async function getHoldersByToken(tokenId: string) {
  return db
    .select()
    .from(agentHoldings)
    .where(eq(agentHoldings.tokenId, tokenId));
}
