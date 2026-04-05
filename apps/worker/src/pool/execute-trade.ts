import { Decimal } from "decimal.js";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import {
  executeBuy,
  executeSell,
  type PoolState,
} from "@degenscreener/pool-engine";

function toState(row: {
  dscreen_reserve: string | number;
  token_reserve: string | number;
  k_constant: string | number;
}): PoolState {
  return {
    dscreenReserve: new Decimal(row.dscreen_reserve),
    tokenReserve: new Decimal(row.token_reserve),
    kConstant: new Decimal(row.k_constant),
  };
}

export interface BuyTradeResult {
  tradeId: string;
  tokensOut: string;
  fee: string;
  priceAfter: string;
  priceImpact: string;
}

export async function executeBuyTrade(
  agentId: string,
  tokenId: string,
  dscreenAmount: string,
): Promise<BuyTradeResult | null> {
  return db.transaction(async (tx) => {
    // Lock pool row
    const poolRows = await tx.execute<{
      dscreen_reserve: string;
      token_reserve: string;
      k_constant: string;
    }>(
      sql`SELECT dscreen_reserve, token_reserve, k_constant FROM liquidity_pools WHERE token_id = ${tokenId} FOR UPDATE`,
    );
    const poolRow = poolRows.rows?.[0];
    if (!poolRow) return null;
    const pool = toState(poolRow);

    // Load agent and verify funds
    const [agent] = await tx
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, agentId));
    if (!agent) return null;
    const bal = new Decimal(agent.balance);
    const amt = new Decimal(dscreenAmount);
    if (bal.lt(amt)) return null;

    // Fetch token for creator/supply
    const [token] = await tx
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.id, tokenId));
    if (!token || token.status !== "ACTIVE") return null;

    // CPMM
    const r = executeBuy(pool, amt);

    // Update pool
    await tx
      .update(schema.liquidityPools)
      .set({
        dscreenReserve: r.newPool.dscreenReserve.toFixed(18),
        tokenReserve: r.newPool.tokenReserve.toFixed(18),
        kConstant: r.newPool.kConstant.toFixed(36),
        totalVolume: sql`${schema.liquidityPools.totalVolume} + ${amt.toFixed(18)}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.liquidityPools.tokenId, tokenId));

    // Deduct buyer balance, add volume
    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} - ${amt.toFixed(18)}`,
        totalVolume: sql`${schema.agents.totalVolume} + ${amt.toFixed(18)}`,
      })
      .where(eq(schema.agents.id, agentId));

    // Credit fee to creator Dev Agent
    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} + ${r.fee.toFixed(18)}`,
        totalFeesEarned: sql`${schema.agents.totalFeesEarned} + ${r.fee.toFixed(18)}`,
      })
      .where(eq(schema.agents.id, token.creatorAgentId));

    // Upsert holding (update avg entry)
    const [existing] = await tx
      .select()
      .from(schema.agentHoldings)
      .where(
        and(
          eq(schema.agentHoldings.agentId, agentId),
          eq(schema.agentHoldings.tokenId, tokenId),
        ),
      );

    const netIn = amt.sub(r.fee);
    const priceEff = netIn.div(r.tokensOut);

    if (existing) {
      const oldQty = new Decimal(existing.quantity);
      const oldEntry = new Decimal(existing.avgEntryPrice);
      const newQty = oldQty.add(r.tokensOut);
      const newEntry = oldQty
        .mul(oldEntry)
        .add(r.tokensOut.mul(priceEff))
        .div(newQty);
      await tx
        .update(schema.agentHoldings)
        .set({
          quantity: newQty.toFixed(18),
          avgEntryPrice: newEntry.toFixed(18),
          updatedAt: new Date(),
        })
        .where(eq(schema.agentHoldings.id, existing.id));
    } else {
      await tx.insert(schema.agentHoldings).values({
        agentId,
        tokenId,
        quantity: r.tokensOut.toFixed(18),
        avgEntryPrice: priceEff.toFixed(18),
      });
    }

    // Insert trade
    const [trade] = await tx
      .insert(schema.trades)
      .values({
        agentId,
        tokenId,
        type: "BUY",
        dscreenAmount: amt.toFixed(18),
        tokenAmount: r.tokensOut.toFixed(18),
        priceAtTrade: r.priceAfter.toFixed(18),
        feeAmount: r.fee.toFixed(18),
      })
      .returning();

    return {
      tradeId: trade!.id,
      tokensOut: r.tokensOut.toFixed(18),
      fee: r.fee.toFixed(18),
      priceAfter: r.priceAfter.toFixed(18),
      priceImpact: r.priceImpact.toFixed(18),
    };
  });
}

export interface SellTradeResult {
  tradeId: string;
  dscreenOut: string;
  fee: string;
  priceAfter: string;
  priceImpact: string;
  realizedPnl: string;
}

export async function executeSellTrade(
  agentId: string,
  tokenId: string,
  tokenAmount: string,
): Promise<SellTradeResult | null> {
  return db.transaction(async (tx) => {
    const poolRows = await tx.execute<{
      dscreen_reserve: string;
      token_reserve: string;
      k_constant: string;
    }>(
      sql`SELECT dscreen_reserve, token_reserve, k_constant FROM liquidity_pools WHERE token_id = ${tokenId} FOR UPDATE`,
    );
    const poolRow = poolRows.rows?.[0];
    if (!poolRow) return null;
    const pool = toState(poolRow);

    // Holding check
    const [holding] = await tx
      .select()
      .from(schema.agentHoldings)
      .where(
        and(
          eq(schema.agentHoldings.agentId, agentId),
          eq(schema.agentHoldings.tokenId, tokenId),
        ),
      );
    if (!holding) return null;
    const heldQty = new Decimal(holding.quantity);
    const sellQty = new Decimal(tokenAmount);
    if (sellQty.gt(heldQty) || sellQty.lte(0)) return null;

    // Pool capacity: sell cannot drain pool.
    if (pool.dscreenReserve.lte(0)) return null;

    const [token] = await tx
      .select()
      .from(schema.tokens)
      .where(eq(schema.tokens.id, tokenId));
    if (!token) return null;

    const r = executeSell(pool, sellQty);

    // Update pool
    await tx
      .update(schema.liquidityPools)
      .set({
        dscreenReserve: r.newPool.dscreenReserve.toFixed(18),
        tokenReserve: r.newPool.tokenReserve.toFixed(18),
        kConstant: r.newPool.kConstant.toFixed(36),
        totalVolume: sql`${schema.liquidityPools.totalVolume} + ${r.dscreenOut.toFixed(18)}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.liquidityPools.tokenId, tokenId));

    // Realized pnl: (effective_sell_price - avg_entry) * qty
    const effective = r.dscreenOut.div(sellQty);
    const entry = new Decimal(holding.avgEntryPrice);
    const realized = effective.sub(entry).mul(sellQty);

    // Credit seller DSCREEN out, update pnl+volume
    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} + ${r.dscreenOut.toFixed(18)}`,
        totalVolume: sql`${schema.agents.totalVolume} + ${r.dscreenOut.toFixed(18)}`,
        totalPnl: sql`${schema.agents.totalPnl} + ${realized.toFixed(18)}`,
      })
      .where(eq(schema.agents.id, agentId));

    // Fee to creator
    await tx
      .update(schema.agents)
      .set({
        balance: sql`${schema.agents.balance} + ${r.fee.toFixed(18)}`,
        totalFeesEarned: sql`${schema.agents.totalFeesEarned} + ${r.fee.toFixed(18)}`,
      })
      .where(eq(schema.agents.id, token.creatorAgentId));

    // Update/delete holding
    const newQty = heldQty.sub(sellQty);
    if (newQty.lte(0)) {
      await tx
        .delete(schema.agentHoldings)
        .where(eq(schema.agentHoldings.id, holding.id));
    } else {
      await tx
        .update(schema.agentHoldings)
        .set({ quantity: newQty.toFixed(18), updatedAt: new Date() })
        .where(eq(schema.agentHoldings.id, holding.id));
    }

    const [trade] = await tx
      .insert(schema.trades)
      .values({
        agentId,
        tokenId,
        type: "SELL",
        dscreenAmount: r.dscreenOut.toFixed(18),
        tokenAmount: sellQty.toFixed(18),
        priceAtTrade: r.priceAfter.toFixed(18),
        feeAmount: r.fee.toFixed(18),
      })
      .returning();

    return {
      tradeId: trade!.id,
      dscreenOut: r.dscreenOut.toFixed(18),
      fee: r.fee.toFixed(18),
      priceAfter: r.priceAfter.toFixed(18),
      priceImpact: r.priceImpact.toFixed(18),
      realizedPnl: realized.toFixed(18),
    };
  });
}
