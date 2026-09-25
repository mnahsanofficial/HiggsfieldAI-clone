import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InsufficientCreditsError } from "@/lib/credits/ledger";
import { clientIp, DailyLimitError, hashIp } from "@/lib/jobs/image-quota";
import { balanceOf, JobInputError, listJobs, retryJob, runImageJob } from "@/lib/jobs/service";
import { runVideoJob } from "@/lib/jobs/video";

export const maxDuration = 300;

// A retry is a new job with the same settings, charged again (the failed one was refunded).
export async function POST(request: Request, { params }: RouteContext<"/api/jobs/[id]/retry">) {
  const invokedAt = Date.now();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  try {
    const { jobId, vertical, live } = await retryJob(user.id, id, hashIp(clientIp(request)));
    if (vertical === "image") after(() => runImageJob(jobId));
    else if (live) after(() => runVideoJob(jobId, invokedAt));
    const [job] = await listJobs(user.id, { ids: [jobId] });
    return NextResponse.json({ job, balanceTenths: await balanceOf(user.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits", requiredTenths: err.requiredTenths, balanceTenths: err.balanceTenths }, { status: 402 });
    }
    if (err instanceof DailyLimitError) return NextResponse.json({ error: "daily_limit", scope: err.scope, message: err.message }, { status: 429 });
    if (err instanceof JobInputError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    throw err;
  }
}
