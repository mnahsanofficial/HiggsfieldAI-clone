// Test setup only: creates a registered account directly in the database and prints a session
// token for it, so UI tests can act as a signed-in user without typing a password into a form.
// The account can't sign in with a password (its hash is a placeholder).
// run: npx tsx --conditions react-server scripts/dev/test-account.ts create
//      npx tsx --conditions react-server scripts/dev/test-account.ts delete <userId>
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const { eq } = await import("drizzle-orm");
  const { SignJWT } = await import("jose");
  const { db, pool } = await import("../../src/db");
  const { users } = await import("../../src/db/schema");
  const { grantCredits, STARTER_CREDITS_TENTHS } = await import("../../src/lib/credits/ledger");
  try {
    if (cmd === "create") {
      const id = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({ kind: "registered", displayName: "UI test", email: `ui-test-${Date.now()}@example.test`, passwordHash: "scrypt$ui-test-placeholder" })
          .returning({ id: users.id });
        await grantCredits(tx, u.id, STARTER_CREDITS_TENTHS, "signup_grant", "Welcome credits");
        return u.id;
      });
      const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
      console.log(JSON.stringify({ userId: id, token }));
    } else if (cmd === "delete" && arg) {
      await db.delete(users).where(eq(users.id, arg));
      console.log(JSON.stringify({ deleted: arg }));
    } else throw new Error("usage: test-account.ts create | delete <userId>");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
