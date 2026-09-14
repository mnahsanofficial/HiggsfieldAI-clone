import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { GuestButton } from "@/components/auth/guest-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatCredits } from "@/lib/credits/format";

// Placeholder home until feat/explore: proves the session end to end on the live URL.
export default async function Home() {
  const user = await getCurrentUser();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        HIGGSFIELD <span className="text-accent">CLONE</span>
      </h1>

      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-white/80">
            {user.kind === "guest" ? "Guest session" : `Signed in as ${user.email}`} ·{" "}
            <span className="font-semibold text-accent">{formatCredits(user.creditBalanceTenths)} credits</span>
          </p>
          <div className="flex gap-3">
            {user.kind === "guest" && (
              <Link href="/signup" className="rounded-xl bg-accent px-5 py-3 font-semibold text-black">
                Keep your work: sign up
              </Link>
            )}
            <form action={signOutAction}>
              <button className="rounded-xl border border-white/15 px-5 py-3">Sign out</button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <GuestButton />
          <Link href="/login" className="flex h-12 items-center justify-center rounded-xl border border-white/15 px-6">
            Sign in
          </Link>
        </div>
      )}

      <p className="font-mono text-xs text-white/40">{process.env.VERCEL_ENV ?? "development"} · {commit}</p>
    </main>
  );
}
