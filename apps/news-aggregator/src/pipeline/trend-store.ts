import type { Redis } from "ioredis";
import { db, schema } from "@degenscreener/db";
import { eq, desc } from "drizzle-orm";
import { config } from "../config.js";

/**
 * Update Redis sorted sets with top trending topics for fast access by the simulation worker.
 */
export async function updateTrendStore(redis: Redis) {
  const allTopics = await db
    .select()
    .from(schema.trendingTopics)
    .where(eq(schema.trendingTopics.isStale, false))
    .orderBy(desc(schema.trendingTopics.memabilityScore))
    .limit(config.maxTrendsInRedis);

  if (allTopics.length === 0) return;

  // Calculate composite score for ranking:
  // score = memability * velocity_multiplier * recency_weight
  const velocityMultiplier: Record<string, number> = {
    accelerating: 1.5,
    stable: 1.0,
    declining: 0.5,
  };

  const now = Date.now();
  const scored = allTopics.map((t) => {
    const memScore = Number(t.memabilityScore) || 0;
    const velMul = velocityMultiplier[t.velocity] ?? 1.0;
    const ageHours = (now - new Date(t.firstSeen).getTime()) / 3600000;
    const recencyWeight = Math.max(0.2, 1.0 - ageHours / 24);
    return { topic: t, compositeScore: memScore * velMul * recencyWeight };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // Build pipeline for atomic update
  const pipeline = redis.pipeline();

  // Clear and rebuild all sorted sets
  pipeline.del("trends:all", "trends:crypto", "trends:politics", "trends:pop_culture", "trends:breaking");

  for (const { topic, compositeScore } of scored) {
    const data = JSON.stringify({
      id: topic.id,
      topic: topic.topic,
      category: topic.category,
      memabilityScore: topic.memabilityScore,
      velocity: topic.velocity,
      sourceCount: topic.sourceCount,
      ageMinutes: topic.ageMinutes,
      alreadyLaunched: topic.alreadyLaunched,
      launchedTokenId: topic.launchedTokenId,
      suggestedTickers: topic.suggestedTickers,
    });

    pipeline.zadd("trends:all", compositeScore, data);

    // Category-specific sets
    if (topic.category === "crypto") pipeline.zadd("trends:crypto", compositeScore, data);
    if (topic.category === "politics") pipeline.zadd("trends:politics", compositeScore, data);
    if (topic.category === "pop_culture") pipeline.zadd("trends:pop_culture", compositeScore, data);

    // Breaking: < 30 min old with memability > 7
    if ((topic.ageMinutes ?? 0) < 30 && Number(topic.memabilityScore) > 7) {
      pipeline.zadd("trends:breaking", compositeScore, data);
    }
  }

  // Set TTL on all keys
  for (const key of ["trends:all", "trends:crypto", "trends:politics", "trends:pop_culture", "trends:breaking"]) {
    pipeline.expire(key, config.trendTtlSeconds);
  }

  await pipeline.exec();
  console.log(`[trend-store] Updated Redis with ${scored.length} topics`);
}
