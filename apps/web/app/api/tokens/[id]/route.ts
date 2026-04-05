import { NextResponse } from "next/server";
import { Decimal } from "decimal.js";
import { eq } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [token] = await db
    .select()
    .from(schema.tokens)
    .where(eq(schema.tokens.id, params.id));
  if (!token) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [pool] = await db
    .select()
    .from(schema.liquidityPools)
    .where(eq(schema.liquidityPools.tokenId, token.id));
  const [creator] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, token.creatorAgentId));

  const tr = pool ? new Decimal(pool.tokenReserve) : new Decimal(0);
  const price =
    pool && tr.gt(0) ? new Decimal(pool.dscreenReserve).div(tr) : new Decimal(0);
  const mc = price.mul(token.totalSupply);

  return NextResponse.json({
    token: {
      ...token,
      price: price.toFixed(18),
      marketCap: mc.toFixed(6),
    },
    pool,
    creator: creator
      ? { id: creator.id, name: creator.name, handle: creator.handle }
      : null,
  });
}
