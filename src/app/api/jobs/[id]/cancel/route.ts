import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { balanceOf, cancelJob } from "@/lib/jobs/service";

export async function POST(_request: Request, { params }: RouteContext<"/api/jobs/[id]/cancel">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const canceled = await cancelJob(user.id, id);
  if (!canceled) return NextResponse.json({ error: "not_cancelable" }, { status: 409 });
  return NextResponse.json({ canceled: true, balanceTenths: await balanceOf(user.id) });
}
