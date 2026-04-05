import { sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { and, eq } from "drizzle-orm";

// Approximate USD per 1M tokens (input, output)
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 0.25, out: 1.25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
};

function priceFor(model: string): { in: number; out: number } {
  if (PRICING[model]) return PRICING[model]!;
  // Fuzzy match
  if (model.includes("haiku")) return PRICING["claude-haiku-4-5"]!;
  if (model.includes("sonnet")) return PRICING["claude-sonnet-4-6"]!;
  if (model.includes("mini")) return PRICING["gpt-4o-mini"]!;
  return { in: 1, out: 3 };
}

function hourBucket(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x;
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const p = priceFor(model);
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

export async function trackUsage(
  agentId: string,
  inputTokens: number,
  outputTokens: number,
  model: string,
): Promise<number> {
  const cost = estimateCost(inputTokens, outputTokens, model);
  const bucket = hourBucket();
  await db
    .insert(schema.agentCostTracking)
    .values({
      agentId,
      hourBucket: bucket,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      estimatedCostUsd: cost.toFixed(6),
    })
    .onConflictDoUpdate({
      target: [
        schema.agentCostTracking.agentId,
        schema.agentCostTracking.hourBucket,
      ],
      set: {
        totalInputTokens: sql`${schema.agentCostTracking.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${schema.agentCostTracking.totalOutputTokens} + ${outputTokens}`,
        estimatedCostUsd: sql`${schema.agentCostTracking.estimatedCostUsd} + ${cost.toFixed(6)}`,
        updatedAt: new Date(),
      },
    });
  return cost;
}

const BUDGET = Number(process.env.AGENT_HOURLY_COST_BUDGET ?? 0.5);

export async function isWithinBudget(
  agentId: string,
  estimatedCallCost: number,
): Promise<boolean> {
  const bucket = hourBucket();
  const [row] = await db
    .select({ cost: schema.agentCostTracking.estimatedCostUsd })
    .from(schema.agentCostTracking)
    .where(
      and(
        eq(schema.agentCostTracking.agentId, agentId),
        eq(schema.agentCostTracking.hourBucket, bucket),
      ),
    );
  const current = row ? Number(row.cost) : 0;
  return current + estimatedCallCost <= BUDGET;
}
