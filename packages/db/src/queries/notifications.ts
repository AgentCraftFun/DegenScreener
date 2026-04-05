import { desc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { notifications } from "../schema.js";

type NewNotification = typeof notifications.$inferInsert;

export async function createNotification(data: NewNotification) {
  const [row] = await db.insert(notifications).values(data).returning();
  return row!;
}

export async function getNotificationsByUser(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAsRead(id: string) {
  const [row] = await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id))
    .returning();
  return row!;
}
