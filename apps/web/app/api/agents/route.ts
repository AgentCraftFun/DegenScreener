import { NextResponse } from "next/server";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { and, eq, desc, asc, count, sql } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import {
  AgentType,
  Personality,
  MAX_AGENTS_PER_USER,
} from "@degenscreener/shared";
import { getAuthFromRequest } from "../../../lib/auth";
import {
  parseBody,
  parsePagination,
  err,
  json,
  requireAuth,
  checkRateLimit,
} from "../../../lib/api";
import { randInt } from "../../../lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1).max(64),
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  type: z.nativeEnum(AgentType),
  personality: z.nativeEnum(Personality).optional(),
  initialFunding: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  riskProfile: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const rl = await checkRateLimit(req, "deploy", auth.user.userId);
  if (rl) return rl;
  const parsed = await parseBody(req, CreateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Check agent count
  const [countRow] = await db
    .select({ c: count() })
    .from(schema.agents)
    .where(eq(schema.agents.ownerId, auth.user.userId));
  if ((countRow?.c ?? 0) >= MAX_AGENTS_PER_USER) {
    return err(400, `max ${MAX_AGENTS_PER_USER} agents per user`);
  }

  // Handle uniqueness
  const [existing] = await db
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(eq(schema.agents.handle, body.handle));
  if (existing) return err(409, "handle already taken");

  // V2: No balance check needed — agent gets funded via ETH transfer after creation
  const funding = body.initialFunding ? new Decimal(body.initialFunding) : new Decimal(0);

  const result = await db.transaction(async (tx) => {
    // Optionally deduct from internal balance if V1-style funding provided
    if (funding.gt(0)) {
      const [user] = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, auth.user.userId));
      if (user && new Decimal(user.internalBalance).gte(funding)) {
        await tx
          .update(schema.users)
          .set({
            internalBalance: sql`${schema.users.internalBalance} - ${funding.toFixed(18)}`,
          })
          .where(eq(schema.users.id, auth.user.userId));
      }
    }

    const [agent] = await tx
      .insert(schema.agents)
      .values({
        ownerId: auth.user.userId,
        name: body.name,
        handle: body.handle,
        type: body.type,
        balance: funding.toFixed(18),
        status: "ACTIVE",
        riskProfile: body.riskProfile ?? {},
        personality: body.personality ?? Personality.ANALYTICAL,
        nextEvalTick: randInt(1, 5),
      })
      .returning();
    return agent!;
  });

  // V2: Create agent wallet (if worker creates it, just read it back)
  // The wallet will be created by the worker's wallet manager on first evaluation.
  // Return the agent with its wallet address if already set.
  return json({ agent: { ...result, walletAddress: result.walletAddress ?? null } }, 201);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const sort = url.searchParams.get("sort") ?? "created_at";
  const order = url.searchParams.get("order") ?? "desc";
  const { limit, offset } = parsePagination(url);
  const auth = await getAuthFromRequest(req);

  const orderCol =
    sort === "pnl"
      ? schema.agents.totalPnl
      : sort === "balance"
        ? schema.agents.balance
        : sort === "volume"
          ? schema.agents.totalVolume
          : schema.agents.createdAt;
  const orderFn = order === "asc" ? asc : desc;

  const where = type && type !== "all"
    ? eq(schema.agents.type, type as "DEV" | "DEGEN")
    : undefined;

  const rows = await db
    .select()
    .from(schema.agents)
    .where(where)
    .orderBy(orderFn(orderCol))
    .limit(limit)
    .offset(offset);

  const sanitized = rows.map((r) => {
    const ownerMatches = auth?.userId === r.ownerId;
    if (!ownerMatches) {
      const { balance: _b, ...rest } = r;
      void _b;
      return rest;
    }
    return r;
  });

  return NextResponse.json({ agents: sanitized, page: { limit, offset } });
}
