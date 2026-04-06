import { requireAuth } from "../../../../lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ message: "ok", userId: auth.user.userId });
}
