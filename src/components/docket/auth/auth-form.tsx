"use client";

import Link from "next/link";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useActionState } from "react";
import { type AuthFormState, signInAction, signUpAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ROUTES } from "../routes";

// Sign in and create an account, on the existing server actions. Creating an account from a
// guest session keeps that session's runs and credits.
export function AuthForm({ mode, next, isGuest, retried = false }: { mode: "sign-in" | "sign-up"; next: string; isGuest: boolean; retried?: boolean }) {
  const serverAction = mode === "sign-up" ? signUpAction : signInAction;
  const [state, action, pending] = useActionState<AuthFormState, FormData>(async (prev, data) => {
    try {
      return await serverAction(prev, data);
    } catch (e) {
      // A server action's id changes with every build: a page opened before a deploy posts one
      // the new deployment doesn't know. Reload it (once) and ask for another try, rather than
      // failing silently. The reloaded page renders the note from ?retry=1.
      if (unstable_isUnrecognizedActionError(e) && !retried) {
        const url = new URL(window.location.href);
        url.searchParams.set("retry", "1");
        window.location.replace(url);
        return prev;
      }
      throw e;
    }
  }, undefined);
  const q = next !== ROUTES.home ? `?next=${encodeURIComponent(next)}` : "";
  const err = (field: "email" | "password" | "name") => (state?.field === field ? state.error : undefined);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="t-display">{mode === "sign-up" ? "Create an account" : "Sign in"}</h1>
        <p className="t-body text-muted">
          {mode === "sign-up"
            ? isGuest
              ? "Your guest session's runs and credits move into the new account."
              : "Keep your runs and credits, and publish the ones you choose."
            : "Welcome back. Your log is where you left it."}
        </p>
      </div>

      {retried && (
        <p role="status" className="t-body rounded-xl bg-field p-4" data-testid="retry-note">
          Docket was updated while this page was open, so it reloaded. Please try again.
        </p>
      )}
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        {mode === "sign-up" && (
          <Field id="name" label="Name" hint="Optional. Shown only to you." error={err("name")}>
            <TextInput id="name" name="name" autoComplete="name" invalid={!!err("name")} />
          </Field>
        )}
        <Field id="email" label="Email" error={err("email")}>
          <TextInput id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} invalid={!!err("email")} aria-describedby={err("email") ? "email-error" : undefined} />
        </Field>
        <Field id="password" label="Password" hint={mode === "sign-up" ? "At least 8 characters." : undefined} error={err("password")}>
          <TextInput id="password" name="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} required invalid={!!err("password")} aria-describedby={err("password") ? "password-error" : mode === "sign-up" ? "password-hint" : undefined} />
        </Field>
        {state?.error && !state.field && (
          <p role="alert" className="t-body text-charged">
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" pending={pending}>
          {mode === "sign-up" ? "Create the account" : "Sign in"}
        </Button>
      </form>

      <p className="t-meta">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href={`${ROUTES.signIn}${q}`} className="inline-block py-2 font-semibold text-ink underline underline-offset-2">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`${ROUTES.signUp}${q}`} className="inline-block py-2 font-semibold text-ink underline underline-offset-2">
              Create an account
            </Link>{" "}
            or just{" "}
            <Link href={ROUTES.make} className="inline-block py-2 font-semibold text-ink underline underline-offset-2">
              start making
            </Link>
            : no account needed.
          </>
        )}
      </p>
    </main>
  );
}
