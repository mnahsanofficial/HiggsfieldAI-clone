"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { formatCredits } from "@/lib/credits/format";
import { ROUTES } from "./routes";

type Account = { kind: "guest" | "registered"; email: string | null; balanceTenths: number };

// The right side of the header when there's a session: a menu button showing the balance.
// A WAI-ARIA menu button: arrow keys move through the items, Escape closes and returns focus to
// the button, a click outside closes. A guest's account lives only in this browser's cookie, so
// the menu leads with creating an account, and a guest's sign-out asks first.
export function AccountMenu({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  const guest = account.kind === "guest";
  const balance = `${formatCredits(account.balanceTenths)} credits`;

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const focusItem = (i: number) => {
    const all = items();
    all[(i + all.length) % all.length]?.focus();
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  // A click or tap anywhere outside closes the menu, without stealing focus back.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Opening moves focus into the menu, once it's rendered.
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusItem(focusOnOpen.current === "first" ? 0 : -1);
    focusOnOpen.current = null;
  }, [open]);
  const openAt = (which: "first" | "last") => {
    focusOnOpen.current = which;
    setOpen(true);
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt("last");
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const item = "flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[0.9375rem] font-medium hover:bg-field focus-visible:bg-field";

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        id={`${id}-button`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => (open ? setOpen(false) : openAt("first"))}
        onKeyDown={onButtonKey}
        className="flex h-9 items-center gap-1 rounded-lg bg-field px-2.5 sm:gap-1.5 sm:px-3 text-[0.875rem] font-semibold tabular-nums hover:bg-[#e5e6e1]"
        data-testid="account-button"
      >
        {balance}
        <span className="sr-only">, account menu</span>
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className={open ? "rotate-180" : ""}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        ref={menu}
        id={`${id}-menu`}
        role="menu"
        aria-label={guest ? "Guest session" : `Signed in as ${account.email}`}
        hidden={!open}
        onKeyDown={onMenuKey}
        // Following a link closes the menu (sign-out submits its form and leaves the page anyway).
        onClick={(e) => (e.target as HTMLElement).closest('a[role="menuitem"]') && setOpen(false)}
        className="absolute right-0 top-full z-40 mt-2 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-0.5 rounded-xl border border-line bg-paper p-1.5 shadow-[0_8px_30px_rgba(20,22,26,0.12)]"
        data-testid="account-menu"
      >
        {guest && (
          <Link href={`${ROUTES.signUp}?next=${encodeURIComponent(pathname || "/")}`} role="menuitem" tabIndex={-1} className={`${item} bg-ink text-paper hover:bg-[#2b2e34] focus-visible:bg-[#2b2e34]`}>
            Create an account to keep your runs
          </Link>
        )}
        <div role="none" className="px-3 pb-1 pt-2">
          <p className="t-label truncate" title={account.email ?? undefined}>
            {guest ? "Guest" : account.email}
          </p>
          {guest && <p className="t-meta">This session lives only in this browser.</p>}
        </div>
        <Link href={ROUTES.credits} role="menuitem" tabIndex={-1} className={`${item} justify-between gap-3`}>
          <span>Balance</span>{" "}
          <span className="tabular-nums text-muted">{balance}</span>
        </Link>
        <Link href={ROUTES.log} role="menuitem" tabIndex={-1} className={item}>
          Your log
        </Link>
        <div role="none" className="my-1 border-t border-line" />
        {guest ? (
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={item}
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            Sign out
          </button>
        ) : (
          <form action={signOutAction} role="none">
            <button type="submit" role="menuitem" tabIndex={-1} className={item}>
              Sign out
            </button>
          </form>
        )}
      </div>

      {guest && (
        <Sheet
          open={confirming}
          onClose={() => {
            setConfirming(false);
            button.current?.focus();
          }}
          title="Sign out of this guest session?"
        >
          <div className="flex flex-col gap-4" data-testid="guest-sign-out">
            <p className="t-body">
              A guest session exists only in this browser&apos;s cookie. If you sign out, every run you made in it becomes unreachable for good, along with its {balance}. There&apos;s no way to get them back.
            </p>
            <p className="t-body">Create an account first and they stay yours.</p>
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <ButtonLink href={`${ROUTES.signUp}?next=${encodeURIComponent(pathname || "/")}`}>Create an account</ButtonLink>
              <form action={signOutAction}>
                <Button type="submit" variant="danger" className="w-full">
                  Sign out and lose these runs
                </Button>
              </form>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
