import { and, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";

// Soft delete: the row stays (jobs and the ledger still reference it) but it disappears from
// Assets and History. Blob files are left in place: deleting costs no uploads and storage is
// not the binding limit on this plan.
export async function DELETE(_request: Request, { params }: RouteContext<"/api/assets/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const [deleted] = await db
    .update(assets)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(assets.id, id), eq(assets.userId, user.id), isNull(assets.deletedAt)))
    .returning({ id: assets.id });
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
