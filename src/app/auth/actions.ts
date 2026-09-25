"use server";

import { redirect } from "next/navigation";
import { registerUser, signIn } from "@/lib/auth/accounts";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createSession, destroySession } from "@/lib/auth/session";
import { ROUTES } from "@/components/docket/routes";

export type AuthFormState = { error?: string; field?: "email" | "password" | "name"; email?: string } | undefined;

// Only same-site relative paths, so ?next= can't redirect off-site.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const current = await getCurrentUser();
  const result = await registerUser({
    email,
    password: String(formData.get("password") ?? ""),
    displayName: String(formData.get("name") ?? ""),
    currentGuestId: current?.kind === "guest" ? current.id : null,
  });
  if (!result.ok) return { error: result.error, field: result.field, email };
  await createSession(result.userId);
  redirect(safeNext(formData.get("next")));
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await signIn(email, String(formData.get("password") ?? ""));
  if (!result.ok) return { error: result.error, email };
  await createSession(result.userId);
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect(ROUTES.home);
}
