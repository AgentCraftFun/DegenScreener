import { Decimal } from "decimal.js";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { removeLiquidity } from "@degenscreener/pool-engine";

export async function rugToken(
  devAgentId: string,
  tokenId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.id, tokenId));
    if (!token || token.creatorAgentId !== devAgentId || token.status !== "ACTIVE")
      return false;

    const poolRows = await tx.execute<{
      dscreen_reserve: string;
      token_reserve: string;
    }>(
      sql`SELECT dscreen_reserve, token_reserve FROM liquidity_pools WHERE token_id = ${tokenId} FOR UPDATE`,
    );
    const poolRow = poolRows.rows?.[0];
    if (!poolRow) return false;

    const { dscreenRecovered, residualPool } = removeLiquidity({
      dscreenReserve: new Decimal(poolRow.dscreen_reserve),
      tokenReserve: new Decimal(poolRow.token_reserve),
      kConstant: new Decimal(0),
    });

    await tx
      .update(schema.liquidityPools)
      .set({
        dscreenReserve: residualPool.dscreenReserve.toFixed(18),
        tokenReserve: residualPool.tokenReserve.toFixed(18),
        kConstant: "0",
        updatedAt: new Date(),
      })
      .where(eq(schema.liquidityPools.tokenId, tokenId));

    await tx
      .update(schema.tokens)
      .set({ status: "RUGGED" })
      .where(eq(schema.tokens.id, tokenId));

    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} + ${dscreenRecovered.toFixed(18)}`,
        rugCount: sql`${schema.agents.rugCount} + 1`,
      })
      .where(eq(schema.agents.id, devAgentId));

    return true;
  });
}
