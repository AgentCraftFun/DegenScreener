import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../client.js";
import { agents } from "../schema.js";

type NewAgent = typeof agents.$inferInsert;

export async function createAgent(data: NewAgent) {
  const [row] = await db.insert(agents).values(data).returning();
  return row!;
}

export async function getAgentById(id: string) {
  const [row] = await db.select().from(agents).where(eq(agents.id, id));
  return row ?? null;
}

export async function getAgentsByOwner(ownerId: string) {
  return db.select().from(agents).where(eq(agents.ownerId, ownerId));
}

export async function getActiveAgentsForTick(tick: number) {
  return db
    .select()
    .from(agents)
    .where(
      and(eq(agents.status, "ACTIVE"), lte(agents.nextEvalTick, tick)),
    );
}

export async function updateAgentBalance(id: string, delta: string) {
  const [row] = await db
    .update(agents)
    .set({ balance: sql`${agents.balance} + ${delta}` })
    .where(eq(agents.id, id))
    .returning();
  return row!;
}

export async function updateAgentStatus(
  id: string,
  status: "ACTIVE" | "BROKE",
) {
  const [row] = await db
    .update(agents)
    .set({ status })
    .where(eq(agents.id, id))
    .returning();
  return row!;
}

export async function reactivateAgent(id: string, topUp: string) {
  const [row] = await db
    .update(agents)
    .set({
      balance: sql`${agents.balance} + ${topUp}`,
      status: "ACTIVE",
      nextEvalTick: 0,
    })
    .where(eq(agents.id, id))
    .returning();
  return row!;
}

export async function updateAgentConfig(
  id: string,
  patch: Partial<Pick<NewAgent, "name" | "personality" | "riskProfile">>,
) {
  const [row] = await db
    .update(agents)
    .set(patch)
    .where(eq(agents.id, id))
    .returning();
  return row!;
}
