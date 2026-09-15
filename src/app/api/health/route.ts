import { NextResponse } from "next/server";

// Deployment identity for smoke checks: which commit is live, in which environment.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
  });
}
