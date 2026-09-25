// The account menu through the real UI. Signed out it's "Sign in". With a session it's a menu
// button showing the balance: aria-expanded, arrow keys, Home/End, Escape returns focus, a click
// outside closes, 32px targets, and it fits at 390px. A guest's menu leads with creating an
// account, and a guest's sign-out warns before it loses the runs; a registered account signs out
// at once (local servers only: the test session is signed with the local secret). Both land
// on home. Makes nothing; deletes its accounts afterwards.
// usage: node scripts/dev/ui-menu-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , base, shotDir, flag] = process.argv;
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

const cleanup = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "docket-menu-")), args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });

  // 1. Signed out: "Sign in", as before.
  await page.goto(`${base}/make`, { waitUntil: "networkidle0", timeout: 60000 });
  check("signed out: the header says Sign in, and there's no account menu", (await page.$$eval("header a", (as) => as.some((a) => a.textContent.trim() === "Sign in" && a.getAttribute("href") === "/sign-in"))) && !(await page.$(BTN)));

  // 2. A guest session.
  await page.evaluate(() => fetch("/api/auth/guest", { method: "POST" }));
  const guestToken = await sessionCookie(page);
  const guestId = JSON.parse(Buffer.from(guestToken.split(".")[1], "base64url").toString()).sub;
  cleanup.push(guestId);
  await page.goto(`${base}/make`, { waitUntil: "networkidle0" });
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
  await page.mouse.click(mobile ? 40 : 200, 400);
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
  await page.click(BTN);
  await page.evaluate((m) => [...document.querySelectorAll(`${m} [role="menuitem"]`)].find((e) => e.textContent.trim() === "Sign out").click(), MENU);
  await page.waitForSelector("dialog[open] [data-testid='guest-sign-out']");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.evaluate(() => [...document.querySelectorAll("dialog[open] button")].find((b) => b.textContent.trim() === "Sign out and lose these runs").click())]);
  check("confirming signs the guest out and goes home", new URL(page.url()).pathname === "/" && !(await sessionCookie(page)) && !(await page.$(BTN)));

  // 3. A registered account signs out at once. The test account's session is signed with the
  // local AUTH_SECRET, so this part runs against a local server only; on a deployment it's noted.
  const local = ["localhost", "127.0.0.1"].includes(new URL(base).hostname);
  if (!local) results.push("NOTE  registered sign-out not run: test sessions are signed with the local secret (covered by the local run)");
  if (local) {
    const acct = JSON.parse(tsx("scripts/dev/test-account.ts", "create"));
    cleanup.push(acct.userId);
    await page.setCookie({ name: "docket_session", value: acct.token, url: base });
    await page.goto(`${base}/log`, { waitUntil: "networkidle0" });
    await page.click(BTN);
    const regItems = await menuItems(page);
    const regText = await page.$eval(MENU, (m) => m.innerText);
    check("registered: the menu shows the email, and no create-account prompt", /ui-test-\d+@example\.test/.test(regText) && !regText.includes("Create an account") && regItems[0]?.t.startsWith("Balance"), regItems.map((i) => i.t).join(" | "));
    await shot(page, "3-registered-menu");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.evaluate((m) => [...document.querySelectorAll(`${m} [role="menuitem"]`)].find((e) => e.textContent.trim() === "Sign out").click(), MENU)]);
    check("registered: sign out is immediate, and goes home", new URL(page.url()).pathname === "/" && !(await page.$("dialog[open]")) && !(await page.$(BTN)) && !(await sessionCookie(page)));
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
