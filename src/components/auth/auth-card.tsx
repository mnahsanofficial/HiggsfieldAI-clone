"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthFormState, signInAction, signUpAction } from "@/app/auth/actions";
import { GuestButton } from "./guest-button";

type Props = {
  mode: "signin" | "signup";
  next: string;
  isGuest: boolean;
};

export function AuthCard({ mode, next, isGuest }: Props) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "signup" ? signUpAction : signInAction,
    undefined,
  );
  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mx-auto grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#141416] md:grid-cols-2">
      {/* Media panel, like the reference's signup modal. Replaced by seeded generations in chore/seed-library. */}
      <div className="relative hidden min-h-[520px] overflow-hidden bg-[radial-gradient(120%_80%_at_20%_10%,#3b4a12_0%,#141416_55%),radial-gradient(90%_70%_at_90%_90%,#4a1238_0%,transparent_60%)] md:block">
        <div className="absolute inset-x-6 bottom-6">
          <span className="inline-flex rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">Real image generation</span>
          <p className="mt-3 text-3xl font-black uppercase leading-none tracking-tight">
            Direct the shot,
            <br />
            <span className="text-accent">not just the prompt</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6 sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-white/55">
            {mode === "signup" ? "Sign up and generate for free." : "Sign in to your library and credits."}
          </p>
        </div>

        {!isGuest && (
          <div className="flex flex-col gap-2">
            <GuestButton next={next} />
            <p className="text-center text-xs text-white/45">No email. 100 free credits. Sign up later to keep your work.</p>
          </div>
        )}

        {!isGuest && (
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
        )}

        {isGuest && mode === "signup" && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
            You&apos;re in a guest session. Signing up keeps everything you&apos;ve made and your credits.
          </p>
        )}
        {isGuest && mode === "signin" && (
          <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/70">
            Signing in leaves this guest session. To keep its work, <Link className="text-accent underline" href={`/signup${nextQuery}`}>sign up</Link> instead.
          </p>
        )}

        <form action={formAction} className="flex flex-col gap-3" noValidate>
          <input type="hidden" name="next" value={next} />
          {mode === "signup" && (
            <Field label="Name" name="name" autoComplete="name" placeholder="Optional" />
          )}
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state?.email}
            error={state?.field === "email" ? state.error : undefined}
            required
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "At least 8 characters" : undefined}
            error={state?.field === "password" ? state.error : undefined}
            required
          />
          {state?.error && !state.field && <p className="text-sm text-red-400">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-1 h-12 rounded-xl border border-white/15 bg-white/5 font-semibold transition hover:bg-white/10 disabled:opacity-60"
          >
            {pending ? "Please wait…" : mode === "signup" ? "Sign up with email" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-white/55">
          {mode === "signup" ? (
            <>
              Already have an account? <Link className="text-white underline" href={`/login${nextQuery}`}>Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link className="text-white underline" href={`/signup${nextQuery}`}>Create an account</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-white/70">{label}</span>
      <input
        {...input}
        aria-invalid={error ? true : undefined}
        className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-base outline-none transition placeholder:text-white/30 focus:border-accent/60 aria-invalid:border-red-400/70"
      />
      {error && <span className="text-red-400">{error}</span>}
    </label>
  );
}
