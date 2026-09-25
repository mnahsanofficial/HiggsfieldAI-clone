"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ROUTES } from "@/components/docket/routes";

// A page failed to load (usually the database for a moment). Say so, and nothing was charged:
// charges only happen when a run is accepted, and failed runs are refunded.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
      <h1 className="t-display">This page didn&apos;t load</h1>
      <p className="t-body text-muted">Something failed on our side, usually for a moment. Nothing was charged. Try again.</p>
      {error.digest && <p className="t-meta">Reference {error.digest}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href={ROUTES.home} variant="secondary">
          Home
        </ButtonLink>
      </div>
    </main>
  );
}
