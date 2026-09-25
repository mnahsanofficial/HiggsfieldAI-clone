import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatCredits } from "@/lib/credits/format";
import { ROUTES } from "./routes";

// Three places and a balance. The wordmark is type only: the product's boldness is spent on
// the commit, not on the logo.
export async function DocketHeader() {
  const user = await getCurrentUser();
  const nav = [
    { href: ROUTES.make, label: "Make" },
    { href: ROUTES.log, label: "Log" },
    { href: ROUTES.credits, label: "Credits" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-2 px-4 sm:gap-6">
        <Link href={ROUTES.home} className="-ml-1.5 rounded-lg px-1.5 py-1 text-[1.0625rem] font-bold tracking-[-0.02em]">
          Docket
        </Link>
        <nav aria-label="Main" className="flex min-w-0 flex-1 items-center gap-0.5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-2.5 py-2 text-[0.9375rem] font-medium text-muted hover:bg-field hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <Link href={ROUTES.credits} className="flex h-9 shrink-0 items-center rounded-lg bg-field px-3 text-[0.875rem] font-semibold tabular-nums">
            {formatCredits(user.creditBalanceTenths)} credits
            <span className="sr-only">, view balance and plans</span>
          </Link>
        ) : (
          <Link href={ROUTES.signIn} className="flex h-9 shrink-0 items-center rounded-lg px-3 text-[0.875rem] font-semibold hover:bg-field">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
