import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

// Sign out, as a plain form POST rather than a server action. A server action's id changes with
// every build, so a tab opened before a deploy would post an id the new deployment doesn't know,
// and sign-out silently did nothing. A route has no id to go stale, and works before JS loads.
export async function POST(request: Request) {
  // Same-origin only: the browser's Origin header (or, failing that, Sec-Fetch-Site) must say
  // the form was posted from this site. The cookie is SameSite=Lax as well.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const crossSite = origin ? new URL(origin).host !== host : site !== null && site !== "same-origin";
  if (crossSite) return new NextResponse("Sign-out has to come from this site.", { status: 403 });

  await destroySession();
  // 303: the browser follows with a GET to home, a full page load with no session, so the
  // header can't show a stale balance.
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return NextResponse.redirect(`${proto}://${host}/`, 303);
}
