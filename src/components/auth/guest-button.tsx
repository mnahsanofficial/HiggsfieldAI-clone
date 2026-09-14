"use client";

import { useActionState } from "react";
import { type AuthFormState, guestAction } from "@/app/auth/actions";

// One-click guest session, no email. Used on the landing page and the auth card.
export function GuestButton({ next = "/", className = "", label = "Try instantly as a guest" }: { next?: string; className?: string; label?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(guestAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={pending}
        className={`h-12 rounded-xl bg-accent px-6 font-semibold text-black transition hover:brightness-95 disabled:opacity-60 ${className}`}
      >
        {pending ? "Starting…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-center text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
