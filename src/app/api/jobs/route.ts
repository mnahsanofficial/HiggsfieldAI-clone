import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { InsufficientCreditsError } from "@/lib/credits/ledger";
import { balanceOf, JobInputError, listJobs, runImageJob, submitImageJob, sweepStaleJobs } from "@/lib/jobs/service";

// after() runs the job inside this invocation once the response is sent.
export const maxDuration = 300;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input", message: "Expected JSON." }, { status: 400 });
  }

  try {
    const { jobId, costTenths } = await submitImageJob(user.id, {
      modelId: String(body.modelId ?? ""),
      prompt: String(body.prompt ?? ""),
      aspect: String(body.aspect ?? ""),
      resolution: String(body.resolution ?? ""),
      batchSize: Number(body.batchSize ?? 1),
    });
    after(() => runImageJob(jobId));
    const [job] = await listJobs(user.id, { ids: [jobId] });
    return NextResponse.json({ job, costTenths, balanceTenths: await balanceOf(user.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "insufficient_credits", requiredTenths: err.requiredTenths, balanceTenths: err.balanceTenths },
        { status: 402 },
      );
    }
    if (err instanceof JobInputError) return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    throw err;
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(request.url);
  const vertical = url.searchParams.get("vertical");
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);

  await sweepStaleJobs(); // piggybacks on polling traffic; throttled
  const jobs = await listJobs(user.id, {
    vertical: vertical === "image" || vertical === "video" ? vertical : undefined,
    ids,
  });
  return NextResponse.json({ jobs, balanceTenths: await balanceOf(user.id) });
}
