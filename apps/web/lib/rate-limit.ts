import { getRedis } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  const k = `rl:${key}`;
  const count = await redis.incr(k);
  if (count === 1) {
    await redis.expire(k, windowSec);
  }
  if (count > limit) {
    const ttl = await redis.ttl(k);
    return { allowed: false, retryAfter: Math.max(1, ttl), remaining: 0 };
  }
  return { allowed: true, retryAfter: 0, remaining: limit - count };
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  return "unknown";
}
