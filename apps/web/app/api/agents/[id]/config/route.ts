import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@degenscreener/db";
import { Personality } from "@degenscreener/shared";
import { requireAuth, parseBody } from "../../../../../lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  riskProfile: z.record(z.unknown()).optional(),
  personality: z.nativeEnum(Personality).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const parsed = await parseBody(req, PatchSchema);
  if (!parsed.ok) return parsed.response;

  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, params.id));
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (agent.ownerId !== auth.user.userId)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.riskProfile) patch.riskProfile = parsed.data.riskProfile;
  if (parsed.data.personality) patch.personality = parsed.data.personality;

  const [updated] = await db
    .update(schema.agents)
    .set(patch)
    .where(eq(schema.agents.id, agent.id))
    .returning();
  return NextResponse.json({ agent: updated });
}
