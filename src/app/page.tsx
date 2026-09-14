import Link from "next/link";
import { GuestButton } from "@/components/auth/guest-button";
import { getCurrentUser } from "@/lib/auth/current-user";

// Placeholder home until feat/explore.
export default async function Home() {
  const user = await getCurrentUser();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        HIGGSFIELD <span className="text-accent">CLONE</span>
      </h1>
      {user ? (
        <p className="text-white/70">
          {user.kind === "guest" ? "You're in a guest session." : `Signed in as ${user.email}.`}{" "}
          <Link href="/credits" className="text-accent underline">View credits</Link>
        </p>
      ) : (
        <GuestButton />
      )}
      <p className="font-mono text-xs text-white/40">{process.env.VERCEL_ENV ?? "development"} · {commit}</p>
    </main>
  );
}
