import { db, schema } from "@degenscreener/db";
import { sql, isNull, desc } from "drizzle-orm";

/**
 * Deduplicate recent news items and group them into trending topics.
 * Simple MVP approach: extract key terms from headlines, group by overlap.
 */
export async function runDedup() {
  // Fetch unlinked news items (no topic_id yet)
  const unlinked = await db
    .select()
    .from(schema.newsItems)
    .where(isNull(schema.newsItems.topicId))
    .orderBy(desc(schema.newsItems.fetchedAt))
    .limit(100);

  if (unlinked.length === 0) return;

  // Extract key terms from each headline
  const STOP_WORDS = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "and", "but", "or", "nor",
    "not", "so", "yet", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "only", "own", "same", "than", "too", "very",
    "just", "because", "about", "up", "down", "it", "its", "he", "she",
    "they", "we", "you", "i", "me", "my", "your", "his", "her", "their",
    "our", "this", "that", "these", "those", "what", "which", "who",
    "whom", "how", "when", "where", "why", "all", "also", "new", "says",
    "said", "report", "reports", "according", "us", "uk",
  ]);

  function extractKeyTerms(headline: string): string[] {
    return headline
      .replace(/[^\w\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
      .map((w) => w.toLowerCase());
  }

  // Get existing non-stale topics
  const existingTopics = await db
    .select()
    .from(schema.trendingTopics)
    .where(sql`${schema.trendingTopics.isStale} = false`);

  for (const item of unlinked) {
    const terms = extractKeyTerms(item.headline);
    if (terms.length === 0) continue;

    // Try to match against existing topics
    let matched = false;
    for (const topic of existingTopics) {
      const topicTerms = extractKeyTerms(topic.topic);
      const overlap = terms.filter((t) => topicTerms.includes(t));
      if (overlap.length >= 3) {
        // Link this news item to the existing topic
        await db
          .update(schema.newsItems)
          .set({ topicId: topic.id })
          .where(sql`${schema.newsItems.id} = ${item.id}`);

        // Update topic source count and last_seen
        await db
          .update(schema.trendingTopics)
          .set({
            sourceCount: sql`${schema.trendingTopics.sourceCount} + 1`,
            lastSeen: sql`NOW()`,
          })
          .where(sql`${schema.trendingTopics.id} = ${topic.id}`);

        // Update in-memory copy
        topic.sourceCount = (topic.sourceCount ?? 0) + 1;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Create a new topic from this headline
      const topicName = terms.slice(0, 5).join(" ");
      const [newTopic] = await db
        .insert(schema.trendingTopics)
        .values({
          topic: topicName,
          category: item.category ?? "world",
          memabilityScore: "0",
          velocity: "stable",
          sourceCount: 1,
        })
        .returning();

      if (newTopic) {
        await db
          .update(schema.newsItems)
          .set({ topicId: newTopic.id })
          .where(sql`${schema.newsItems.id} = ${item.id}`);

        existingTopics.push(newTopic);
      }
    }
  }

  console.log(`[dedup] Processed ${unlinked.length} unlinked news items`);
}
