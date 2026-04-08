import axios from "axios";
import { db, schema } from "@degenscreener/db";
import { sql, eq } from "drizzle-orm";
import { config } from "../config.js";

/**
 * Score trending topics for memability using LLM.
 * Topics below threshold are excluded from agent prompts.
 */
export async function scoreMemability() {
  // Find unscored topics (memability_score = 0, not stale)
  const unscored = await db
    .select()
    .from(schema.trendingTopics)
    .where(
      sql`${schema.trendingTopics.isStale} = false AND ${schema.trendingTopics.memabilityScore} = 0`,
    )
    .limit(20);

  if (unscored.length === 0) return;

  // Check blocklist first
  for (const topic of unscored) {
    const isBlocked = config.blockedKeywords.some((kw) =>
      topic.topic.toLowerCase().includes(kw.toLowerCase()),
    );
    if (isBlocked) {
      await db
        .update(schema.trendingTopics)
        .set({ memabilityScore: "0", isStale: true })
        .where(eq(schema.trendingTopics.id, topic.id));
    }
  }

  const scoreable = unscored.filter(
    (t) => !config.blockedKeywords.some((kw) => t.topic.toLowerCase().includes(kw.toLowerCase())),
  );
  if (scoreable.length === 0) return;

  if (!config.anthropicApiKey) {
    // Without LLM, assign a default score based on source count
    for (const topic of scoreable) {
      const score = Math.min(topic.sourceCount * 2, 8);
      await db
        .update(schema.trendingTopics)
        .set({ memabilityScore: String(score) })
        .where(eq(schema.trendingTopics.id, topic.id));
    }
    console.log(`[memability] Scored ${scoreable.length} topics (heuristic, no LLM)`);
    return;
  }

  try {
    const resp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Rate each topic 1-10 on memability — how likely is it that crypto degens would launch a memecoin about this?

Consider: humor potential, cultural relevance, controversy, virality.
A boring Fed report = 2. A celebrity scandal = 8. An absurd political quote = 9. A major sports upset = 6.

Topics:
${scoreable.map((t, i) => `${i + 1}. [${t.category}] ${t.topic} (${t.sourceCount} sources)`).join("\n")}

Respond as JSON array: [{ "index": 1, "score": 7, "reasoning": "..." }, ...]`,
          },
        ],
      },
      {
        headers: {
          "x-api-key": config.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    const text = resp.data?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[memability] Could not parse LLM response");
      return;
    }

    const results = JSON.parse(jsonMatch[0]) as { index: number; score: number; reasoning: string }[];

    for (const result of results) {
      const topic = scoreable[result.index - 1];
      if (!topic) continue;

      await db
        .update(schema.trendingTopics)
        .set({ memabilityScore: String(Math.min(Math.max(result.score, 0), 10)) })
        .where(eq(schema.trendingTopics.id, topic.id));
    }

    console.log(`[memability] Scored ${results.length} topics via LLM`);
  } catch (err) {
    console.error("[memability] LLM scoring error:", err);
  }
}
