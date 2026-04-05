import { Decimal } from "decimal.js";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { createPool } from "@degenscreener/pool-engine";

export interface LaunchedToken {
  tokenId: string;
  ticker: string;
}

export async function launchToken(
  devAgentId: string,
  ticker: string,
  name: string,
  initialLiquidity: string,
  totalSupply: string,
): Promise<LaunchedToken | null> {
  return db.transaction(async (tx) => {
    const [agent] = await tx
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, devAgentId));
    if (!agent) return null;
    const bal = new Decimal(agent.balance);
    const liq = new Decimal(initialLiquidity);
    if (bal.lt(liq) || liq.lte(0)) return null;

    // Check ticker uniqueness first
    const existing = await tx
      .select({ id: schema.tokens.id })
      .from(schema.tokens)
      .where(eq(schema.tokens.ticker, ticker));
    if (existing.length > 0) return null;

    const [token] = await tx
      .insert(schema.tokens)
      .values({
        ticker,
        name,
        creatorAgentId: devAgentId,
        totalSupply,
        status: "ACTIVE",
      })
      .returning();
    if (!token) return null;

    const pool = createPool(liq, totalSupply);

    await tx.insert(schema.liquidityPools).values({
      tokenId: token.id,
      dscreenReserve: pool.dscreenReserve.toFixed(18),
      tokenReserve: pool.tokenReserve.toFixed(18),
      kConstant: pool.kConstant.toFixed(36),
      totalVolume: "0",
    });

    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} - ${liq.toFixed(18)}`,
        tokensLaunched: sql`${schema.agents.tokensLaunched} + 1`,
      })
      .where(eq(schema.agents.id, devAgentId));

    return { tokenId: token.id, ticker };
  });
}
