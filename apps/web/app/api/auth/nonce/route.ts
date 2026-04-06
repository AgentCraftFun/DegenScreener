import { NextResponse } from "next/server";
import { getRedis } from "../../../../lib/redis";
import { checkRateLimit } from "../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "auth");
  if (rl) return rl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const redis = getRedis();
  await redis.setex(`nonce:${nonce}`, 300, "1");
  return NextResponse.json({ nonce });
}
