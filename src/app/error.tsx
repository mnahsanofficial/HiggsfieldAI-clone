"use client";

import Link from "next/link";
import { useEffect } from "react";

// A render or data error inside a page: say so plainly and offer a retry, keeping the header.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-black uppercase tracking-tight">Something broke on our side</h1>
      <p className="text-sm text-white/55">This page couldn&apos;t load. Nothing was charged: generations are only charged when they&apos;re accepted, and failures are refunded.</p>
      {error.digest && <p className="font-mono text-xs text-white/35">ref {error.digest}</p>}
      <div className="mt-2 flex w-full gap-2">
        <button type="button" onClick={reset} className="h-11 flex-1 rounded-xl bg-accent font-semibold text-black">
          Try again
        </button>
        <Link href="/" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-white/10 font-semibold hover:bg-white/15">
          Explore
        </Link>
      </div>
    </main>
  );
}
