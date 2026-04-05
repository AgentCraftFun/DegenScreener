import { NextResponse, type NextRequest } from "next/server";

// Edge-compatible CORS middleware. Rate limiting happens in route handlers
// via per-route helpers because the Redis client is Node-only.

const FRONTEND_URL = process.env.FRONTEND_URL ?? "*";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", FRONTEND_URL);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
