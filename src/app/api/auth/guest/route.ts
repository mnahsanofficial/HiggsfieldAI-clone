import { NextResponse } from "next/server";
import { createGuest } from "@/lib/auth/accounts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createSession } from "@/lib/auth/session";

// JSON counterpart of the guest button, so a signed-out visitor can type a prompt and press
// Generate: the studio creates the guest session inline and submits, no detour.
export async function POST(request: Request) {
  const existing = await getCurrentUser();
  if (existing) return NextResponse.json({ ok: true, userId: existing.id });
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await createGuest(ip);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 429 });
  await createSession(result.userId);
  return NextResponse.json({ ok: true, userId: result.userId }, { status: 201 });
}
