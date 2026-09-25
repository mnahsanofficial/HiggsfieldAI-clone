import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteOutputs, getLogEntry } from "@/lib/log/entries";

// One run. Owners see their own; everyone else only sees published runs.
export async function GET(_request: Request, ctx: RouteContext<"/api/log/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const entry = await getLogEntry(id, user?.id ?? null);
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entry });
}

// Deletes a run's output (and takes it out of the public log). The run stays on the record.
export async function DELETE(_request: Request, ctx: RouteContext<"/api/log/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(await deleteOutputs(user.id, id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
