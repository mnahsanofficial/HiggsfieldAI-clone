// The account menu through the real UI. Signed out it's "Sign in". With a session it's a menu
// button showing the balance: aria-expanded, arrow keys, Home/End, Escape returns focus, a click
// outside closes, 32px targets, and it fits at 390px. A guest's menu leads with creating an
// account, and a guest's sign-out warns before it loses the runs; a registered account signs out
// at once (local servers only: the test session is signed with the local secret). Both land
// on home. Makes nothing; deletes its accounts afterwards.
// usage: node scripts/dev/ui-menu-e2e.mjs [baseUrl] [screenshotDir] [--mobile]   (baseUrl defaults to the live site)
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LIVE_URL } from "./live-url.mjs";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , baseArg, shotDir, flag] = process.argv;
const base = baseArg || LIVE_URL;
const mobile = flag === "--mobile";
const tag = mobile ? "mobile" : "desktop";
const results = [];
const check = (name, ok, info = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
if (shotDir) mkdirSync(shotDir, { recursive: true });
const shot = async (page, name) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${tag}.png` });
const tsx = (...args) => execFileSync("npx", ["tsx", "--conditions", "react-server", ...args], { encoding: "utf8" });
const BTN = '[data-testid="account-button"]';
const MENU = '[data-testid="account-menu"]';
const expanded = (page) => page.$eval(BTN, (b) => b.getAttribute("aria-expanded"));
const menuShown = (page) => page.$eval(MENU, (m) => !m.hidden && m.getBoundingClientRect().height > 0);
const focused = (page) => page.evaluate(() => document.activeElement?.textContent.replace(/\s+/g, " ").trim() ?? "");
// Focus moves once the menu has rendered; wait for it rather than racing it.
const focusSettles = (page, want) => page.waitForFunction((w) => document.activeElement?.textContent.replace(/\s+/g, " ").trim() === w, { timeout: 2000 }, want).then(() => true, () => false);
const menuItems = (page) => page.$$eval(`${MENU} [role="menuitem"]`, (els) => els.map((e) => ({ t: e.textContent.replace(/\s+/g, " ").trim(), href: e.getAttribute("href"), h: e.getBoundingClientRect().height })));
const sessionCookie = async (page) => (await page.cookies()).find((c) => c.name === "docket_session")?.value;

// Completes a sign-out and checks all of it: "Signing out…" while it runs, a POST to the route
// (not a server action), home, the cookie gone, "Sign in" in the header without a refresh, and
// still signed out after a reload.
async function completeSignOut(page, who, signOut) {
  // First with the navigation cancelled, to read the pending state: a submit listener on window
  // runs after React's (which sets "Signing out…") and stops the browser leaving. Then for real.
  const here = page.url();
  await page.evaluate(() => window.addEventListener("submit", (e) => e.preventDefault(), { once: true }));
  await signOut();
  const pendingLabel = await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Signing out…" && b.disabled), { timeout: 5000 }).then(() => true, () => false);
  // Reload to a fresh page (still signed in); retry if Chrome is still settling.
  for (let i = 0; i < 3; i++) {
    const ok = await page.goto(here, { waitUntil: "domcontentloaded" }).then(() => true, () => false);
    if (ok && (await page.waitForSelector(BTN, { timeout: 15000 }).then(() => true, () => false))) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const posts = [];
  const onResponse = (r) => r.request().method() === "POST" && posts.push({ path: new URL(r.url()).pathname, status: r.status(), action: !!r.request().headers()["next-action"] });
  page.on("response", onResponse);
  await signOut();
  await page.waitForFunction(() => location.pathname === "/" && !!document.querySelector("header nav"), { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll("header a")].some((a) => a.textContent.trim() === "Sign in"), { timeout: 10000 }).catch(() => {});
  const header = await page.$eval("header", (h) => h.innerText.replace(/\s+/g, " ").trim());
  const cookieGone = !(await sessionCookie(page));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("header nav");
  const afterReload = await page.$eval("header", (h) => h.innerText.replace(/\s+/g, " ").trim());
  page.off("response", onResponse);
  const route = posts.find((x) => x.path === "/api/auth/sign-out");
  check(`${who}: the button says "Signing out…", and can't be pressed twice, while it runs`, pendingLabel);
  check(`${who}: sign-out posts to /api/auth/sign-out (a route, not a server action) and gets a 303`, !!route && route.status === 303 && !route.action, JSON.stringify(posts));
  check(`${who}: lands on home, the session cookie is gone, and the header says Sign in without a refresh`, new URL(page.url()).pathname === "/" && cookieGone && /Sign in/.test(header) && !/credits/.test(header), header);
  check(`${who}: a reload stays signed out`, /Sign in/.test(afterReload) && !(await sessionCookie(page)) && !(await page.$(BTN)), afterReload);
}

// One request handler for the whole run, switched by a flag:
// - stale: rewrite every server-action id to one from another build, as a tab opened before a
//   deploy would send;
const STALE_ACTION_ID = "006c66078c5ea8bbc3db01beb4c00a6be9638357fb";
const net = { stale: false };
async function interceptRequests(page) {
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const h = r.headers();
    if (net.stale && h["next-action"]) return r.continue({ headers: { ...h, "next-action": STALE_ACTION_ID } });
    r.continue();
  });
}

const cleanup = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "docket-menu-")), args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await interceptRequests(page);
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });

  // 1. Signed out: "Sign in", as before.
  // Wait for elements, not network idle: /make has autoplaying camera moves that never let the
  // network go idle.
  await page.goto(`${base}/make`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("header nav");
  check("signed out: the header says Sign in, and there's no account menu", (await page.$$eval("header a", (as) => as.some((a) => a.textContent.trim() === "Sign in" && a.getAttribute("href") === "/sign-in"))) && !(await page.$(BTN)));

  // 2. A guest session.
  await page.evaluate(() => fetch("/api/auth/guest", { method: "POST" }));
  const guestToken = await sessionCookie(page);
  const guestId = JSON.parse(Buffer.from(guestToken.split(".")[1], "base64url").toString()).sub;
  cleanup.push(guestId);
  await page.goto(`${base}/make`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(BTN);
  const btn = await page.$eval(BTN, (b) => ({ text: b.childNodes[0].textContent.trim(), popup: b.getAttribute("aria-haspopup"), controls: b.getAttribute("aria-controls"), h: b.getBoundingClientRect().height }));
  check("with a session, the button shows the balance and is a menu button", /^\d+ credits$/.test(btn.text) && btn.popup === "menu" && !!btn.controls && btn.h >= 32, JSON.stringify(btn));
  const clash = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); const links = [...document.querySelectorAll('header nav a')].filter((a) => a.offsetParent).map((a) => a.getBoundingClientRect()); return { last: Math.round(Math.max(...links.map((r) => r.right))), button: Math.round(b.left) }; }, BTN);
  check("the button doesn't cover the nav", clash.last <= clash.button, JSON.stringify(clash));
  check("closed at first: aria-expanded is false and the menu is hidden", (await expanded(page)) === "false" && !(await menuShown(page)));

  await page.click(BTN);
  const items = await menuItems(page);
  check("click opens it: aria-expanded true, focus on the first item", (await focusSettles(page, items[0]?.t)) && (await expanded(page)) === "true" && (await menuShown(page)));
  check("a guest's menu leads with 'Create an account to keep your runs'", items[0]?.t === "Create an account to keep your runs" && items[0]?.href.startsWith("/sign-up"));
  check("it says who you are: Guest", (await page.$eval(MENU, (m) => m.innerText)).includes("Guest"));
  check("then balance (→ /credits), your log, and sign out", items.slice(1).map((i) => `${i.t.replace(/ \d+ credits$/, "")}→${i.href}`).join(", ") === "Balance→/credits, Your log→/log, Sign out→null" && items[1].t.endsWith(btn.text), items.map((i) => i.t).join(" | "));
  check("every item is at least 32px tall", items.every((i) => i.h >= 32), items.map((i) => Math.round(i.h)).join(","));
  const rect = await page.$eval(MENU, (m) => { const r = m.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  check("the menu fits the viewport", rect.l >= 0 && rect.r <= rect.w, JSON.stringify(rect));
  check("no horizontal overflow with the menu open", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-guest-menu");

  // Keyboard.
  await page.keyboard.press("ArrowDown");
  const second = await focused(page);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const wrapped = await focused(page);
  await page.keyboard.press("Home");
  const home = await focused(page);
  await page.keyboard.press("End");
  const end = await focused(page);
  check("arrow keys move through the items and wrap; Home and End jump", second === items[1].t && wrapped === "Sign out" && home === items[0].t && end === "Sign out", [second, wrapped, home, end].join(" | "));
  await page.keyboard.press("Escape");
  check("Escape closes it and returns focus to the button", (await expanded(page)) === "false" && !(await menuShown(page)) && (await page.evaluate((s) => document.activeElement === document.querySelector(s), BTN)));
  await page.keyboard.press("ArrowUp");
  check("ArrowUp on the button opens it at the last item", (await focusSettles(page, "Sign out")) && (await expanded(page)) === "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  check("Enter on the button opens it at the first item", (await focusSettles(page, items[0].t)) && (await expanded(page)) === "true");
  // The outside-click listener attaches just after the menu paints; a person can't click outside
  // within that frame, but a script can, so let two frames pass first.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.mouse.click(mobile ? 40 : 200, 400);
  await page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-expanded") === "false", { timeout: 2000 }, BTN).catch(() => {});
  check("a click outside closes it", (await expanded(page)) === "false" && !(await menuShown(page)));

  // Guest sign-out asks first, and says exactly what's lost.
  await page.click(BTN);
  await page.evaluate((m) => [...document.querySelectorAll(`${m} [role="menuitem"]`)].find((e) => e.textContent.trim() === "Sign out").click(), MENU);
  await page.waitForSelector("dialog[open] [data-testid='guest-sign-out']");
  await page.waitForFunction(() => document.querySelector("dialog[open]").getAnimations().every((a) => a.playState === "finished"));
  const warn = await page.$eval("dialog[open]", (d) => d.innerText);
  check("a guest's sign-out asks first", warn.includes("Sign out of this guest session?") && (await sessionCookie(page)) === guestToken);
  check("and says exactly what happens: only in this browser's cookie, every run unreachable for good", warn.includes("exists only in this browser's cookie") && warn.includes("every run you made in it becomes unreachable for good"), warn.replace(/\s+/g, " ").slice(0, 200));
  await shot(page, "2-guest-sign-out");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  check("backing out keeps the session", (await sessionCookie(page)) === guestToken && !!(await page.$(BTN)));
  // As a tab opened before a deploy: every server-action id it sends is stale. Sign-out still works.
  net.stale = true;
  await completeSignOut(page, "guest, as a stale tab", async () => {
    await page.click(BTN);
    await page.evaluate((m) => [...document.querySelectorAll(`${m} [role="menuitem"]`)].find((e) => e.textContent.trim() === "Sign out").click(), MENU);
    await page.waitForSelector("dialog[open] [data-testid='guest-sign-out']");
    await page.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Sign out and lose these runs").click());
  });
  net.stale = false;

  // 3. A registered account signs out at once. The test account's session is signed with the
  // local AUTH_SECRET, so this part runs against a local server only; on a deployment it's noted.
  const local = ["localhost", "127.0.0.1"].includes(new URL(base).hostname);
  if (!local) results.push("NOTE  registered sign-out not run: test sessions are signed with the local secret (covered by the local run)");
  if (local) {
    const acct = JSON.parse(tsx("scripts/dev/test-account.ts", "create"));
    cleanup.push(acct.userId);
    await page.setCookie({ name: "docket_session", value: acct.token, url: base });
    await page.goto(`${base}/log`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(BTN);
    await page.click(BTN);
    const regItems = await menuItems(page);
    const regText = await page.$eval(MENU, (m) => m.innerText);
    check("registered: the menu shows the email, and no create-account prompt", /ui-test-\d+@example\.test/.test(regText) && !regText.includes("Create an account") && regItems[0]?.t.startsWith("Balance"), regItems.map((i) => i.t).join(" | "));
    await shot(page, "3-registered-menu");
    const dialogBefore = !!(await page.$("dialog[open]"));
    await completeSignOut(page, "registered", async () => {
      if ((await page.$eval(BTN, (b) => b.getAttribute("aria-expanded"))) !== "true") await page.click(BTN);
      await page.evaluate((m) => [...document.querySelectorAll(`${m} [role="menuitem"]`)].find((e) => e.textContent.trim() === "Sign out").click(), MENU);
    });
    check("registered: no warning, sign-out is immediate", !dialogBefore);

    // 4. Sign-in from a stale tab: the action isn't found, so the page reloads and asks again.
    // Local only: it types a made-up email and password into the form.
    await page.goto(`${base}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email");
    net.stale = true;
    await page.type("#email", "nobody@example.test");
    await page.type("#password", "not-a-real-password");
    await page.evaluate(() => [...document.querySelectorAll("main form button[type=submit]")].find((b) => b.textContent.trim() === "Sign in").click());
    await page.waitForFunction(() => location.search.includes("retry=1"), { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('[data-testid="retry-note"]', { timeout: 20000 }).catch(() => {});
    const note = await page.$eval('[data-testid="retry-note"]', (e) => e.innerText).catch(() => "");
    check("sign-in from a stale tab reloads and asks to try again, instead of failing silently", new URL(page.url()).searchParams.get("retry") === "1" && note.includes("Please try again"), note);
    net.stale = false;
  }
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
  for (const id of cleanup) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/test-account.ts", "delete", id], { stdio: "ignore" });
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
