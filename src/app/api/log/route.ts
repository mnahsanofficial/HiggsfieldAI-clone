import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { clientIp, hashIp, imageQuota } from "@/lib/jobs/image-quota";
import { sweepStaleJobs } from "@/lib/jobs/service";
import { listCreditEvents, listMyLog, listPublicLog } from "@/lib/log/entries";

// The log, read from Postgres. scope=mine is the caller's own runs; scope=public is
// opt-in published runs plus the seed library, so the home page always has real rows.
// include=credits adds the credit movements that aren't runs (welcome credits, plan credits)
// falling in the same time window as the page of runs, so a list reconciles with the balance.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "mine" ? "mine" : "public";
  const before = url.searchParams.get("before") ?? undefined;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 50);
  const user = await getCurrentUser();
  // The real numbers for the free image allowance, so every screen can show them.
  const quota = await imageQuota(user?.id ?? null, hashIp(clientIp(request)));

  if (scope === "mine") {
    if (!user) return NextResponse.json({ entries: [], credits: [], balanceTenths: null, signedIn: false, quota });
    await sweepStaleJobs(); // polling traffic drives the stale-job sweep; throttled inside
    const entries = await listMyLog(user.id, { limit, before });
    const full = entries.length === limit;
    const credits = url.searchParams.get("include") === "credits" ? await listCreditEvents(user.id, { before, after: full ? entries[entries.length - 1].createdAt : undefined }) : [];
    return NextResponse.json({ entries, credits, balanceTenths: user.creditBalanceTenths, signedIn: true, more: full, quota });
  }
  return NextResponse.json({ entries: await listPublicLog(user?.id ?? null, { limit, before }), balanceTenths: user?.creditBalanceTenths ?? null, signedIn: !!user, quota });
}
