import { eq, desc } from "drizzle-orm";
import { db } from "../client.js";
import { newsItems } from "../schema.js";

type NewNewsItem = typeof newsItems.$inferInsert;

export async function insertNewsItem(data: NewNewsItem) {
  const [row] = await db.insert(newsItems).values(data).returning();
  return row!;
}

export async function getRecentByTopic(topicId: string, limit = 20) {
  return db
    .select()
    .from(newsItems)
    .where(eq(newsItems.topicId, topicId))
    .orderBy(desc(newsItems.fetchedAt))
    .limit(limit);
}

export async function getRecentNews(limit = 50) {
  return db
    .select()
    .from(newsItems)
    .orderBy(desc(newsItems.fetchedAt))
    .limit(limit);
}
