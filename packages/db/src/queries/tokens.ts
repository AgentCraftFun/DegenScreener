import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { tokens } from "../schema.js";

type NewToken = typeof tokens.$inferInsert;

export async function createToken(data: NewToken) {
  const [row] = await db.insert(tokens).values(data).returning();
  return row!;
}

export async function getTokenById(id: string) {
  const [row] = await db.select().from(tokens).where(eq(tokens.id, id));
  return row ?? null;
}

export async function getTokenByTicker(ticker: string) {
  const [row] = await db.select().from(tokens).where(eq(tokens.ticker, ticker));
  return row ?? null;
}

export async function getActiveTokens() {
  return db.select().from(tokens).where(eq(tokens.status, "ACTIVE"));
}

export async function updateTokenStatus(
  id: string,
  status: "ACTIVE" | "RUGGED" | "DEAD",
) {
  const [row] = await db
    .update(tokens)
    .set({ status })
    .where(eq(tokens.id, id))
    .returning();
  return row!;
}
