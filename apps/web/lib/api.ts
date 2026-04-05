import { NextResponse } from "next/server";
import type { z } from "zod";
import { getAuthFromRequest, type AuthPayload } from "./auth";
import { rateLimit, getClientIp } from "./rate-limit";

export type RateLimitScope = "general" | "auth" | "money" | "deploy";

const LIMITS: Record<RateLimitScope, { limit: number; window: number }> = {
  general: { limit: 100, window: 60 },
  auth: { limit: 10, window: 60 },
  money: { limit: 5, window: 60 },
  deploy: { limit: 3, window: 60 },
};

export async function checkRateLimit(
  req: Request,
  scope: RateLimitScope,
  userKey?: string,
): Promise<Response | null> {
  const { limit, window } = LIMITS[scope];
  const key = userKey
    ? `${scope}:user:${userKey}`
    : `${scope}:ip:${getClientIp(req)}`;
  const result = await rateLimit(key, limit, window);
  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: "rate limit exceeded",
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "Retry-After": String(result.retryAfter),
        },
      },
    );
  }
  return null;
}

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function err(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: err(400, "invalid JSON") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: err(400, "validation failed", {
        issues: result.error.issues,
      }),
    };
  }
  return { ok: true, data: result.data };
}

export async function requireAuth(
  req: Request,
): Promise<{ ok: true; user: AuthPayload } | { ok: false; response: Response }> {
  const user = await getAuthFromRequest(req);
  if (!user) return { ok: false, response: err(401, "unauthorized") };
  return { ok: true, user };
}

export function parsePagination(url: URL): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));
  return { page, limit, offset: (page - 1) * limit };
}
