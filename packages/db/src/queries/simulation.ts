import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { simulationState } from "../schema.js";

export async function getSimulationState() {
  const [row] = await db.select().from(simulationState).where(eq(simulationState.id, 1));
  return row ?? null;
}

export async function ensureSimulationState() {
  const existing = await getSimulationState();
  if (existing) return existing;
  const [row] = await db
    .insert(simulationState)
    .values({ id: 1, currentTick: 0n })
    .returning();
  return row!;
}

export async function updateSimulationState(currentTick: bigint) {
  const [row] = await db
    .update(simulationState)
    .set({ currentTick, lastTickAt: new Date(), updatedAt: new Date() })
    .where(eq(simulationState.id, 1))
    .returning();
  return row!;
}
