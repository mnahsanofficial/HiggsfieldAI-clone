"use client";

import { type FormHTMLAttributes, type ReactNode, useEffect, useState } from "react";

export const SIGN_OUT_PATH = "/api/auth/sign-out";

// Sign-out as a plain form POST to a route (see app/api/auth/sign-out): it works from a tab that
// predates a deploy, and before hydration. Once submitted it reports "Signing out…" until the
// browser lands on home; a page restored from the back-forward cache starts fresh.
export function SignOutForm({ children, ...form }: Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "children"> & { children: (pending: boolean) => ReactNode }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <form
      {...form}
      action={SIGN_OUT_PATH}
      method="post"
      onSubmit={(e) => {
        if (pending) e.preventDefault();
        else setPending(true);
      }}
    >
      {children(pending)}
    </form>
  );
}
