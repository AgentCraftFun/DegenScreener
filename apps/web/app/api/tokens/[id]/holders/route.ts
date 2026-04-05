import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [pool] = await db
    .select()
    .from(schema.liquidityPools)
    .where(eq(schema.liquidityPools.tokenId, params.id));
  const tr = pool ? new Decimal(pool.tokenReserve) : new Decimal(0);
  const price =
    pool && tr.gt(0) ? new Decimal(pool.dscreenReserve).div(tr) : new Decimal(0);

  const rows = await db
    .select({
      agentId: schema.agentHoldings.agentId,
      quantity: schema.agentHoldings.quantity,
      avgEntryPrice: schema.agentHoldings.avgEntryPrice,
      agentName: schema.agents.name,
      handle: schema.agents.handle,
    })
    .from(schema.agentHoldings)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.agentHoldings.agentId))
    .where(eq(schema.agentHoldings.tokenId, params.id))
    .orderBy(desc(schema.agentHoldings.quantity))
    .limit(50);

  const enriched = rows.map((r) => ({
    ...r,
    positionValue: new Decimal(r.quantity).mul(price).toFixed(6),
  }));

  return NextResponse.json({ holders: enriched, currentPrice: price.toFixed(18) });
}
