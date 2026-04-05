import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "../client.js";
import { liquidityPools } from "../schema.js";

type NewPool = typeof liquidityPools.$inferInsert;

export async function createPool(data: NewPool) {
  const [row] = await db.insert(liquidityPools).values(data).returning();
  return row!;
}

export async function getPoolByTokenId(tokenId: string) {
  const [row] = await db
    .select()
    .from(liquidityPools)
    .where(eq(liquidityPools.tokenId, tokenId));
  return row ?? null;
}

export async function getPoolByTokenIdForUpdate(tx: Tx, tokenId: string) {
  const rows = await tx.execute(
    sql`SELECT * FROM liquidity_pools WHERE token_id = ${tokenId} FOR UPDATE`,
  );
  return (rows.rows?.[0] ?? null) as Record<string, unknown> | null;
}

export async function updatePoolReserves(
  txOrDb: Tx | typeof db,
  tokenId: string,
  dscreenReserve: string,
  tokenReserve: string,
  kConstant: string,
  volumeDelta = "0",
) {
  const executor = txOrDb ?? db;
  const [row] = await executor
    .update(liquidityPools)
    .set({
      dscreenReserve,
      tokenReserve,
      kConstant,
      totalVolume: sql`${liquidityPools.totalVolume} + ${volumeDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(liquidityPools.tokenId, tokenId))
    .returning();
  return row!;
}
