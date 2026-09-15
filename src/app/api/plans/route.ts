import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPlans, PlanError, switchPlanDemo } from "@/lib/billing/plans";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ plans: await listPlans(), currentPlanId: user?.planId ?? null, balanceTenths: user?.creditBalanceTenths ?? null });
}

// Demo purchase: switches plan and grants its credits. No payment is taken or requested.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { planId?: string };
  try {
    const result = await switchPlanDemo(user.id, String(body.planId ?? ""));
    return NextResponse.json({ ...result, planId: body.planId });
  } catch (err) {
    if (err instanceof PlanError) return NextResponse.json({ error: "invalid_plan", message: err.message }, { status: 400 });
    throw err;
  }
}
