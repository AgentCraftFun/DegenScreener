import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-please-32chars+",
);
const COOKIE_NAME = "dscreen_session";
const ALG = "HS256";

export interface AuthPayload {
  userId: string;
  walletAddress: string;
}

export async function signJwt(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET);
}

export async function verifyJwt(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return {
    userId: payload.userId as string,
    walletAddress: payload.walletAddress as string,
  };
}

export async function getAuthFromRequest(
  req: NextRequest | Request,
): Promise<AuthPayload | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return await verifyJwt(decodeURIComponent(match[1]!));
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;

export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
