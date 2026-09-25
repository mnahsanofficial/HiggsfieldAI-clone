import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PublishError, setPublished } from "@/lib/log/entries";

// Publishing a run to the public log, and taking it back down again.
export async function POST(request: Request, ctx: RouteContext<"/api/log/[id]/publish">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { published?: boolean };
  try {
    const published = await setPublished(user.id, id, body.published !== false);
    return NextResponse.json({ id, published });
  } catch (err) {
    if (err instanceof PublishError) return NextResponse.json({ error: "cannot_publish", message: err.message }, { status: 400 });
    throw err;
  }
}
