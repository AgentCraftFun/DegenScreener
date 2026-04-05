import { db, schema } from "@degenscreener/db";
import { and, eq, lte, asc } from "drizzle-orm";
import { randInt } from "../util/rng.js";

export async function getAgentsForTick(tick: number) {
  return db
    .select()
    .from(schema.agents)
    .where(
      and(
        eq(schema.agents.status, "ACTIVE"),
        lte(schema.agents.nextEvalTick, tick),
      ),
    )
    .orderBy(asc(schema.agents.handle));
}

export async function scheduleNextEval(agentId: string, currentTick: number) {
  const next = currentTick + randInt(3, 5);
  await db
    .update(schema.agents)
    .set({ nextEvalTick: next })
    .where(eq(schema.agents.id, agentId));
}

// Circuit breaker: tracks actions per agent in rolling 60s window
class CircuitBreaker {
  private counts = new Map<string, number[]>();
  private readonly limit = 5;
  private readonly windowMs = 60_000;
  enabled = true;

  allow(agentId: string): boolean {
    if (!this.enabled) return true;
    const now = Date.now();
    const arr = this.counts.get(agentId) ?? [];
    const pruned = arr.filter((t) => now - t < this.windowMs);
    if (pruned.length >= this.limit) {
      this.counts.set(agentId, pruned);
      return false;
    }
    pruned.push(now);
    this.counts.set(agentId, pruned);
    return true;
  }

  reset() {
    this.counts.clear();
  }
}

export const circuitBreaker = new CircuitBreaker();
