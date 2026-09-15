// Function-level auth checks against the configured database (run: npx tsx --conditions react-server scripts/verify-auth.ts).
// Creates throwaway users and deletes them afterwards.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { db, pool } = await import("../src/db");
  const { users, creditLedger, systemEvents } = await import("../src/db/schema");
  const acc = await import("../src/lib/auth/accounts");

  const created: string[] = [];
  const results: [string, boolean, string?][] = [];
  const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);
  const stamp = Date.now();
  const email = `e2e-auth-${stamp}@example.test`;
  const testIp = `e2e-ip-${stamp}`;
  const pw = `pw-${stamp}-long`;

  try {
    // 1. New registration gets exactly one 100-credit grant.
    const reg = await acc.registerUser({ email: email.toUpperCase(), password: pw, displayName: "", currentGuestId: null });
    check("register new account", reg.ok);
    if (reg.ok) {
      created.push(reg.userId);
      const [u] = await db.select().from(users).where(eq(users.id, reg.userId));
      check("email normalised to lower case", u.email === email, u.email ?? "");
      check("password stored as scrypt hash, not plaintext", u.passwordHash!.startsWith("scrypt$") && !u.passwordHash!.includes(pw));
      const ledger = await db.select().from(creditLedger).where(eq(creditLedger.userId, reg.userId));
      check("one signup_grant of 100 credits", ledger.length === 1 && ledger[0].deltaTenths === 1000 && u.creditBalanceTenths === 1000);
    }

    // 2. Duplicate email rejected with a field error.
    const dup = await acc.registerUser({ email, password: pw, displayName: "x", currentGuestId: null });
    check("duplicate email rejected", !dup.ok && dup.field === "email", !dup.ok ? dup.error : "");

    // 3. Validation.
    const short = await acc.registerUser({ email: `short-${stamp}@example.test`, password: "1234567", displayName: "", currentGuestId: null });
    check("7-char password rejected", !short.ok && short.field === "password");
    const bad = await acc.registerUser({ email: "not-an-email", password: pw, displayName: "", currentGuestId: null });
    check("malformed email rejected", !bad.ok && bad.field === "email");

    // 4. Sign in: right, wrong, unknown (same message, similar timing).
    check("sign in with correct password", (await acc.signIn(email, pw)).ok);
    let t = performance.now();
    const wrong = await acc.signIn(email, pw + "x");
    const tWrong = performance.now() - t;
    t = performance.now();
    const unknown = await acc.signIn(`nobody-${stamp}@example.test`, pw);
    const tUnknown = performance.now() - t;
    check("wrong password rejected", !wrong.ok && wrong.error === "Email or password is incorrect.");
    check("unknown email gets the identical message", !unknown.ok && unknown.error === "Email or password is incorrect.");
    check("unknown email still spends a hash (timing)", tUnknown > tWrong * 0.5, `wrong ${tWrong.toFixed(0)}ms, unknown ${tUnknown.toFixed(0)}ms`);

    // 5. Guest, then claim: same row, kind flips, no second grant.
    const guest = await acc.createGuest(testIp);
    check("guest created", guest.ok);
    if (guest.ok) {
      const { assets } = await import("../src/db/schema");
      const ex = await db.select({ jobId: assets.jobId, source: assets.source, isPublic: assets.isPublic }).from(assets).where(eq(assets.userId, guest.userId));
      check("guest starts with example images (row copies, private, no job)", ex.length >= 1 && ex.every((a) => a.jobId === null && a.source === "generated" && !a.isPublic), `${ex.length} examples`);
    }
    if (guest.ok) {
      created.push(guest.userId);
      const claimEmail = `e2e-claim-${stamp}@example.test`;
      const claim = await acc.registerUser({ email: claimEmail, password: pw, displayName: "Claimer", currentGuestId: guest.userId });
      check("claim keeps the guest's user id", claim.ok && claim.userId === guest.userId);
      const [u] = await db.select().from(users).where(eq(users.id, guest.userId));
      const ledger = await db.select().from(creditLedger).where(eq(creditLedger.userId, guest.userId));
      check("claimed row is registered with credentials", u.kind === "registered" && u.email === claimEmail);
      check("claim adds no second grant", ledger.length === 1 && u.creditBalanceTenths === 1000);
    }

    // 6. Guest limit: 5 per IP per hour, 6th refused and logged.
    for (let i = 0; i < 4; i++) {
      const g = await acc.createGuest(testIp);
      if (g.ok) created.push(g.userId);
    }
    const sixth = await acc.createGuest(testIp);
    check("6th guest from same IP within the hour refused", !sixth.ok, !sixth.ok ? sixth.error : "");
    if (sixth.ok) created.push(sixth.userId);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(systemEvents).where(eq(systemEvents.kind, "guest_limited"));
    check("limit trip logged to system_events", n >= 1);
    const other = await acc.createGuest(`${testIp}-other`);
    check("a different IP is unaffected", other.ok);
    if (other.ok) created.push(other.userId);
  } finally {
    if (created.length) await db.delete(users).where(inArray(users.id, created));
    // Only this run's events: guest_created rows for our users, guest_limited rows for our test IPs.
    const { createHash } = await import("node:crypto");
    const hashes = [testIp, `${testIp}-other`].map((ip) => createHash("sha256").update(`${process.env.AUTH_SECRET}:${ip}`).digest("hex").slice(0, 32));
    await db.delete(systemEvents).where(sql`${systemEvents.kind} IN ('guest_created','guest_limited') AND (${systemEvents.detail}->>'userId' = ANY(${sql.raw(`ARRAY[${created.map((id) => `'${id}'`).join(",") || "NULL"}]::text[]`)}) OR ${systemEvents.detail}->>'ipHash' = ANY(${sql.raw(`ARRAY[${hashes.map((h) => `'${h}'`).join(",")}]::text[]`)}))`);
    const [{ left }] = await db.select({ left: sql<number>`count(*)::int` }).from(users).where(inArray(users.id, created.length ? created : ["00000000-0000-0000-0000-000000000000"]));
    console.log(`cleanup: removed ${created.length} test users (left: ${left})`);
    await pool.end();
  }

  for (const [name, ok, info] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
  if (results.some(([, ok]) => !ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
