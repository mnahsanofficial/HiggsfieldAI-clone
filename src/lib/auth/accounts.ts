import "server-only";
import { createHash } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { systemEvents, users } from "@/db/schema";
import { grantCredits, STARTER_CREDITS_TENTHS } from "@/lib/credits/ledger";
import { addExampleAssets } from "@/lib/library/examples";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string; field?: "email" | "password" | "name" };

const GUESTS_PER_IP_PER_HOUR = 5;

export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateCredentials(email: string, password: string): AuthResult | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address.", field: "email" };
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters.", field: "password" };
  if (password.length > 200) return { ok: false, error: "Use at most 200 characters.", field: "password" };
  return null;
}

// Registers a new account. If the visitor is already in a guest session, the guest row is
// upgraded in place, so everything they generated as a guest stays theirs.
export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
  currentGuestId: string | null;
}): Promise<AuthResult> {
  const email = normaliseEmail(input.email);
  const invalid = validateCredentials(email, input.password);
  if (invalid) return invalid;
  const displayName = input.displayName.trim().slice(0, 60) || email.split("@")[0];
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      if (input.currentGuestId) {
        const [claimed] = await tx
          .update(users)
          .set({ kind: "registered", email, passwordHash, displayName })
          .where(and(eq(users.id, input.currentGuestId), eq(users.kind, "guest")))
          .returning({ id: users.id });
        if (claimed) return { ok: true as const, userId: claimed.id };
      }
      const [created] = await tx
        .insert(users)
        .values({ kind: "registered", email, passwordHash, displayName })
        .returning({ id: users.id });
      await grantCredits(tx, created.id, STARTER_CREDITS_TENTHS, "signup_grant", "Welcome credits");
      await addExampleAssets(tx, created.id);
      return { ok: true as const, userId: created.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "An account with this email already exists.", field: "email" };
    throw err;
  }
}

export async function signIn(emailInput: string, password: string): Promise<AuthResult> {
  const email = normaliseEmail(emailInput);
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user?.passwordHash) {
    await burnPasswordCheck(password);
    return { ok: false, error: "Email or password is incorrect." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Email or password is incorrect." };
  }
  return { ok: true, userId: user.id };
}

// One click, no email. Limited per IP so the shared image quota can't be drained by
// scripting guest accounts; the IP is stored only as a keyed hash.
export async function createGuest(ip: string | null): Promise<AuthResult> {
  const ipHash = ip ? createHash("sha256").update(`${process.env.AUTH_SECRET}:${ip}`).digest("hex").slice(0, 32) : null;

  if (ipHash) {
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(systemEvents)
      .where(
        and(
          eq(systemEvents.kind, "guest_created"),
          sql`${systemEvents.detail}->>'ipHash' = ${ipHash}`,
          gt(systemEvents.createdAt, sql`now() - interval '1 hour'`),
        ),
      );
    if (recent >= GUESTS_PER_IP_PER_HOUR) {
      await db.insert(systemEvents).values({ kind: "guest_limited", detail: { ipHash } });
      return { ok: false, error: "Too many guest sessions from this network. Try again in an hour, or sign up." };
    }
  }

  const userId = await db.transaction(async (tx) => {
    const [guest] = await tx.insert(users).values({ kind: "guest", displayName: "Guest" }).returning({ id: users.id });
    await grantCredits(tx, guest.id, STARTER_CREDITS_TENTHS, "signup_grant", "Guest credits");
    await addExampleAssets(tx, guest.id);
    await tx.insert(systemEvents).values({ kind: "guest_created", detail: { ipHash, userId: guest.id } });
    return guest.id;
  });
  return { ok: true, userId };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
