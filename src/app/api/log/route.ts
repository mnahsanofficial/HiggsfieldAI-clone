import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listMyLog, listPublicLog } from "@/lib/log/entries";

// The log, read from Postgres. scope=mine is the caller's own runs; scope=public is
// opt-in published runs plus the seed library, so the home page always has real rows.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "mine" ? "mine" : "public";
  const before = url.searchParams.get("before") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const user = await getCurrentUser();

  if (scope === "mine") {
    if (!user) return NextResponse.json({ entries: [], balanceTenths: null, signedIn: false });
    return NextResponse.json({ entries: await listMyLog(user.id, { limit, before }), balanceTenths: user.creditBalanceTenths, signedIn: true });
  }
  return NextResponse.json({ entries: await listPublicLog(user?.id ?? null, { limit, before }), balanceTenths: user?.creditBalanceTenths ?? null, signedIn: !!user });
}
