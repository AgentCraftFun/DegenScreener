import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../client.js";
import { trendingTopics } from "../schema.js";

type NewTopic = typeof trendingTopics.$inferInsert;

export async function upsertTopic(data: NewTopic) {
  const [row] = await db
    .insert(trendingTopics)
    .values(data)
    .onConflictDoUpdate({
      target: trendingTopics.id,
      set: {
        memabilityScore: data.memabilityScore,
        velocity: data.velocity,
        sourceCount: data.sourceCount,
        ageMinutes: data.ageMinutes,
        lastSeen: sql`NOW()`,
        isStale: false,
      },
    })
    .returning();
  return row!;
}

export async function getTopTrends(limit = 10) {
  return db
    .select()
    .from(trendingTopics)
    .where(
      and(
        eq(trendingTopics.isStale, false),
        eq(trendingTopics.alreadyLaunched, false),
      ),
    )
    .orderBy(desc(trendingTopics.memabilityScore))
    .limit(limit);
}

export async function getBreakingNews(limit = 5) {
  return db
    .select()
    .from(trendingTopics)
    .where(eq(trendingTopics.isStale, false))
    .orderBy(desc(trendingTopics.lastSeen))
    .limit(limit);
}

export async function markTopicLaunched(topicId: string, tokenId: string) {
  const [row] = await db
    .update(trendingTopics)
    .set({ alreadyLaunched: true, launchedTokenId: tokenId })
    .where(eq(trendingTopics.id, topicId))
    .returning();
  return row ?? null;
}

export async function getStaleTopics(staleMinutes = 60) {
  return db
    .select()
    .from(trendingTopics)
    .where(
      and(
        eq(trendingTopics.isStale, false),
        sql`${trendingTopics.lastSeen} < NOW() - INTERVAL '${sql.raw(String(staleMinutes))} minutes'`,
      ),
    );
}

export async function markStale(topicId: string) {
  await db
    .update(trendingTopics)
    .set({ isStale: true })
    .where(eq(trendingTopics.id, topicId));
}
