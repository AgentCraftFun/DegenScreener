import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { getRedis } from "../../../../lib/redis";
import { signJwt, buildSessionCookie } from "../../../../lib/auth";
import { db, schema } from "@degenscreener/db";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string(),
  signature: z.string(),
});

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "auth");
  if (rl) return rl;
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(body.message);
  } catch {
    return NextResponse.json({ error: "invalid SIWE message" }, { status: 400 });
  }

  const redis = getRedis();
  const key = `nonce:${parsed.nonce}`;
  const exists = await redis.get(key);
  if (!exists) {
    return NextResponse.json({ error: "nonce invalid or expired" }, { status: 400 });
  }

  try {
    const result = await parsed.verify({ signature: body.signature });
    if (!result.success) {
      return NextResponse.json({ error: "signature verification failed" }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: "verification error" }, { status: 401 });
  }
  await redis.del(key);

  const wallet = parsed.address.toLowerCase();
  // Upsert user
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.walletAddress, wallet));
  let user = existing;
  if (!user) {
    const [created] = await db
      .insert(schema.users)
      .values({ walletAddress: wallet })
      .returning();
    user = created!;
  } else {
    await db
      .update(schema.users)
      .set({ lastActive: new Date() })
      .where(eq(schema.users.id, user.id));
  }

  const token = await signJwt({ userId: user.id, walletAddress: wallet });
  return new NextResponse(
    JSON.stringify({
      user: {
        id: user.id,
        walletAddress: wallet,
        internalBalance: user.internalBalance,
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": buildSessionCookie(token),
      },
    },
  );
}
