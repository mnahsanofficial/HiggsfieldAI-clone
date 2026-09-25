import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLogEntry } from "@/lib/log/entries";

// One run. Owners see their own; everyone else only sees published runs.
export async function GET(_request: Request, ctx: RouteContext<"/api/log/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const entry = await getLogEntry(id, user?.id ?? null);
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entry });
}
