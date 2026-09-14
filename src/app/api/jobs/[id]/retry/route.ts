import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InsufficientCreditsError } from "@/lib/credits/ledger";
import { balanceOf, JobInputError, listJobs, retryJob, runImageJob } from "@/lib/jobs/service";

export const maxDuration = 300;

// A retry is a new job with the same settings, charged again (the failed one was refunded).
export async function POST(_request: Request, { params }: RouteContext<"/api/jobs/[id]/retry">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  try {
    const { jobId } = await retryJob(user.id, id);
    after(() => runImageJob(jobId));
    const [job] = await listJobs(user.id, { ids: [jobId] });
    return NextResponse.json({ job, balanceTenths: await balanceOf(user.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits", requiredTenths: err.requiredTenths, balanceTenths: err.balanceTenths }, { status: 402 });
    }
    if (err instanceof JobInputError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    throw err;
  }
}
