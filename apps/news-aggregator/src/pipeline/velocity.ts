import { db, schema } from "@degenscreener/db";
import { sql, eq, gte, and } from "drizzle-orm";
import { config } from "../config.js";

/**
 * Calculate velocity for each trending topic:
 * Compare source count now vs 30 minutes ago to determine acceleration.
 * Mark stale topics that are old and declining.
 */
export async function updateVelocity() {
  const activeTopics = await db
    .select()
    .from(schema.trendingTopics)
    .where(eq(schema.trendingTopics.isStale, false));

  if (activeTopics.length === 0) return;

  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  for (const topic of activeTopics) {
    // Count news items linked to this topic in the last 30 minutes
    const recentItems = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.newsItems)
      .where(
        and(
          eq(schema.newsItems.topicId, topic.id),
          gte(schema.newsItems.fetchedAt, thirtyMinAgo),
        ),
      );

    const recentCount = Number(recentItems[0]?.count ?? 0);
    const totalCount = topic.sourceCount ?? 1;
    const recentRatio = totalCount > 0 ? recentCount / totalCount : 0;

    // Determine velocity
    let velocity: string;
    if (recentRatio > 0.4) {
      velocity = "accelerating";
    } else if (recentRatio > 0.1) {
      velocity = "stable";
    } else {
      velocity = "declining";
    }

    // Calculate age in minutes
    const ageMinutes = Math.floor((now.getTime() - new Date(topic.firstSeen).getTime()) / 60000);

    // Check for staleness
    const isStale = ageMinutes > config.topicStaleHours * 60 && velocity === "declining";

    await db
      .update(schema.trendingTopics)
      .set({ velocity, ageMinutes, isStale })
      .where(eq(schema.trendingTopics.id, topic.id));
  }

  console.log(`[velocity] Updated ${activeTopics.length} topics`);
}
