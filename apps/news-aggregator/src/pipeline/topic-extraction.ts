import axios from "axios";
import { db, schema } from "@degenscreener/db";
import { sql, isNull, eq } from "drizzle-orm";
import { config } from "../config.js";

/**
 * Use LLM to extract structured topic data and suggest tickers for ambiguous topics.
 * Batch headlines for cost efficiency.
 */
export async function extractTopics() {
  if (!config.anthropicApiKey) {
    // Without LLM, topics just keep their headline-derived names
    return;
  }

  // Find topics with empty suggested_tickers (never been LLM-processed)
  const unprocessed = await db
    .select()
    .from(schema.trendingTopics)
    .where(sql`${schema.trendingTopics.isStale} = false AND jsonb_array_length(${schema.trendingTopics.suggestedTickers}) = 0`)
    .limit(20);

  if (unprocessed.length === 0) return;

  const headlines = unprocessed.map((t) => ({ id: t.id, topic: t.topic, category: t.category }));

  try {
    const resp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `For each topic below, extract:
1. A concise topic name (2-5 words)
2. The best category (politics/crypto/pop_culture/sports/tech/world/finance)
3. Suggest 3 creative memecoin tickers that crypto degens might create for this topic (4-8 chars, all caps, funny/catchy)

Topics:
${headlines.map((h, i) => `${i + 1}. [${h.category}] ${h.topic}`).join("\n")}

Respond as a JSON array: [{ "index": 1, "topic": "...", "category": "...", "tickers": ["$TICK1", "$TICK2", "$TICK3"] }, ...]`,
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
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[topic-extraction] Could not parse LLM response");
      return;
    }

    const results = JSON.parse(jsonMatch[0]) as {
      index: number;
      topic: string;
      category: string;
      tickers: string[];
    }[];

    for (const result of results) {
      const original = headlines[result.index - 1];
      if (!original) continue;

      await db
        .update(schema.trendingTopics)
        .set({
          topic: result.topic,
          category: result.category,
          suggestedTickers: result.tickers,
        })
        .where(eq(schema.trendingTopics.id, original.id));
    }

    console.log(`[topic-extraction] Processed ${results.length} topics via LLM`);
  } catch (err) {
    console.error("[topic-extraction] LLM call error:", err);
  }
}

void isNull;
