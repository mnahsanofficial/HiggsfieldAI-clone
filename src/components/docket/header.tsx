import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AccountMenu } from "./account-menu";
import { ROUTES } from "./routes";

// Three places, and an account menu that shows the balance (or Sign in). The wordmark is type only: the product's boldness is spent on
// the commit, not on the logo.
export async function DocketHeader() {
  const user = await getCurrentUser();
  const nav = [
    { href: ROUTES.make, label: "Make" },
    { href: ROUTES.log, label: "Log" },
    // On a phone with a session, the account menu's Balance goes to /credits, so the nav
    // leaves room for the balance button instead of repeating it.
    { href: ROUTES.credits, label: "Credits", phone: !user },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-2 px-4 sm:gap-6">
        <Link href={ROUTES.home} className="-ml-1.5 rounded-lg px-1.5 py-1 text-[1.0625rem] font-bold tracking-[-0.02em]">
          Docket
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-0.5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={`${"phone" in n && !n.phone ? "hidden sm:block" : ""} rounded-lg px-2 py-2 text-[0.9375rem] font-medium text-muted hover:bg-field hover:text-ink sm:px-2.5`}>
              {n.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <AccountMenu account={{ kind: user.kind, email: user.email, balanceTenths: user.creditBalanceTenths }} />
        ) : (
          <Link href={ROUTES.signIn} className="flex h-9 shrink-0 items-center rounded-lg px-3 text-[0.875rem] font-semibold hover:bg-field">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
