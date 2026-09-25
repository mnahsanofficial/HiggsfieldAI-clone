import { NextResponse } from "next/server";
import { resolvePromo } from "@/lib/billing/promo";

// Checks a promo code for the demo checkout. Only the code is ever sent; card fields stay in the browser.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const promo = await resolvePromo(body.code);
  if (!promo) return NextResponse.json({ error: "invalid_code", message: "That promo code isn't valid." }, { status: 400 });
  return NextResponse.json(promo);
}
