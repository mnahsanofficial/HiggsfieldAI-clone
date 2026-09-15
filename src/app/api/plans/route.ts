import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPlans, PlanError, switchPlanDemo } from "@/lib/billing/plans";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ plans: await listPlans(), currentPlanId: user?.planId ?? null, balanceTenths: user?.creditBalanceTenths ?? null });
}

// Demo checkout: switches plan and grants its credits. Accepts only a plan id and an optional
// promo code; card details never reach the server. No payment is taken.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { planId?: string; promoCode?: string };
  try {
    const result = await switchPlanDemo(user.id, String(body.planId ?? ""), { promoCode: typeof body.promoCode === "string" ? body.promoCode : undefined });
    return NextResponse.json({ ...result, planId: body.planId });
  } catch (err) {
    if (err instanceof PlanError) return NextResponse.json({ error: "invalid_plan", message: err.message }, { status: 400 });
    throw err;
  }
}
