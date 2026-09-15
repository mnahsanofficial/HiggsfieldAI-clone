import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatCredits } from "@/lib/credits/format";
import { CreditGlyph } from "./credits/credit-glyph";

// Only routes that exist are listed; items are added as their surfaces ship, so the nav
// never contains a dead link.
const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Explore" },
  { href: "/ai/image", label: "Image" },
  { href: "/ai/video", label: "Video" },
];

export async function AppHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-black tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs text-black">HF</span>
          <span className="hidden sm:inline">HIGGSFIELD<span className="text-accent"> CLONE</span></span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm text-white/60 [scrollbar-width:none] sm:gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-2 py-1.5 hover:text-white sm:px-2.5">
              {item.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/credits"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold tabular-nums hover:bg-white/10"
              aria-label={`${formatCredits(user.creditBalanceTenths)} credits, view history`}
            >
              <CreditGlyph className="h-3.5 w-3.5 text-accent" />
              {formatCredits(user.creditBalanceTenths)}
            </Link>
            {user.kind === "guest" ? (
              // Hidden on phones to keep the nav unclipped; the balance chip leads to /credits,
              // which carries the guest sign-up call to action.
              <Link href="/signup" className="hidden h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-black sm:flex">
                Sign up
              </Link>
            ) : (
              <form action={signOutAction}>
                <button className="flex h-9 items-center rounded-lg px-2 text-sm text-white/60 hover:text-white" title={user.email ?? undefined}>
                  Sign out
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="hidden h-9 items-center rounded-lg px-3 text-sm text-white/70 hover:text-white sm:flex">
              Login
            </Link>
            <Link href="/signup" className="flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-black">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
