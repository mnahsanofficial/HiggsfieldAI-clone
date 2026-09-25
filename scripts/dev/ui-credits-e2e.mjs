// Credits, the demo checkout and the auth screens through the real UI, as a stranger. Every
// request the page makes is recorded, and none may carry card details. AHSAN345 must still take
// the whole price off; plan credits land once per plan, through the ledger. No images are made.
// Deletes its guest afterwards.
// usage: node scripts/dev/ui-credits-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const text = (page, sel = "main") => page.$eval(sel, (m) => m.innerText).catch(() => "");
const clickExact = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === x); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
const clickStarts = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().startsWith(x)); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
const setValue = (page, sel, v) => page.$eval(sel, (el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, val); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
const headerBalance = (page) => page.evaluate(() => [...document.querySelectorAll("header a, header button")].map((a) => a.textContent.trim()).find((t) => /^[\d.,]+ credits/.test(t))?.replace(/ credits.*/, "") ?? "none");

let guestId = null;
const sent = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-cr-")), args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  page.on("request", (r) => sent.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`));

  await page.goto(`${base}/credits`, { waitUntil: "networkidle0", timeout: 60000 });
  const start = await text(page);
  check("signed out: what you start with, and three plans with what their credits buy", start.includes("You start with") && start.includes("100 credits") && (start.match(/credits a month/g) ?? []).length === 3, start.replace(/\s+/g, " ").slice(0, 120));
  const mine = await text(page, '[data-testid="your-limits"]');
  check("the starter states its limits next to the outcome: 5 images a day, 1 live move as a guest", mine.includes("Enough for 50 images at 2 credits each") && mine.includes("up to 5 a day") && mine.includes("1 live render in a guest session (3 with an account)"), mine.replace(/\s+/g, " "));
  const cardLimits = await page.$$eval('[data-testid^="plan-"][data-testid$="-limits"]', (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  check("every plan card states its daily images and the live-move cap beside the credits", cardLimits.length === 3 && ["up to 10 a day", "up to 15 a day", "up to 20 a day"].every((t, i) => cardLimits[i].includes(t)) && cardLimits.every((c) => c.includes("3 live camera moves per account (1 in a guest session)")), cardLimits.join(" | "));
  check("payments are named as a demo before anything is chosen", start.includes("Checkout is a labelled demo with a test card"));
  check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-credits");

  await clickExact(page, "main button", "Choose Pro");
  await page.waitForSelector("dialog[open] #cc-number");
  const sheet = await text(page, "dialog[open]");
  check("checkout says it's a demo, with a prefilled test card", sheet.includes("Demo checkout, no real payment") && (await page.$eval("#cc-number", (i) => i.value)) === "4242 4242 4242 4242");
  check("card inputs have no name (they can't be form-submitted)", await page.$$eval("#cc-number,#cc-exp,#cc-cvc,#cc-name", (els) => els.every((e) => !e.name)));
  const fullTotal = await text(page, '[data-testid="checkout-total"]');
  await shot(page, "2-checkout");

  const before = sent.filter((s) => s.includes("/api/plans ")).length;
  await setValue(page, "#cc-number", "4242 4242 4242 4241");
  await setValue(page, "#cc-exp", "01/20");
  await clickStarts(page, "dialog[open] button", "Complete demo checkout");
  await new Promise((r) => setTimeout(r, 400));
  const bad = await text(page, "dialog[open]");
  check("a bad number and a past expiry are refused in the browser; nothing is posted", bad.includes("Enter a valid card number.") && bad.includes("This card has expired.") && sent.filter((s) => s.includes("/api/plans ")).length === before);

  await setValue(page, "#promo", "HIGGS50");
  await clickExact(page, "dialog[open] button", "Apply");
  await page.waitForFunction(() => document.querySelector("dialog[open]").innerText.includes("isn't valid"), { timeout: 10000 }).catch(() => {});
  check("any other code: an invalid-code error", (await text(page, "dialog[open]")).includes("That promo code isn't valid"));
  await shot(page, "3-errors");

  await setValue(page, "#cc-number", "4242424242424242");
  await setValue(page, "#cc-exp", "12/34");
  await setValue(page, "#promo", "  ahsan345 ");
  await clickExact(page, "dialog[open] button", "Apply");
  await page.waitForFunction(() => document.querySelector('[data-testid="checkout-total"]')?.innerText === "$0.00", { timeout: 10000 }).catch(() => {});
  check("' ahsan345 ' applies AHSAN345: 100% off, total $0.00", (await text(page, '[data-testid="checkout-total"]')) === "$0.00" && (await text(page, "dialog[open]")).includes("AHSAN345, 100% off") && fullTotal !== "$0.00", `was ${fullTotal}`);
  await shot(page, "4-promo");

  await clickStarts(page, "dialog[open] button", "Complete demo checkout");
  await page.waitForFunction(() => document.querySelector("dialog[open]")?.innerText.includes("Pro is your plan now"), { timeout: 20000 });
  const done = await text(page, "dialog[open]");
  check("success: Pro is your plan, +600 added, 'no payment taken'", done.includes("+600") && done.includes("added") && done.includes("no payment taken"));
  await page.waitForFunction(() => [...document.querySelectorAll("header a, header button")].some((a) => a.textContent.startsWith("700 credits")), { timeout: 15000 }).catch(() => {});
  check("the header balance updates to 700", (await headerBalance(page)) === "700", await headerBalance(page));
  await shot(page, "5-done");
  await clickExact(page, "dialog[open] button", "Done");
  check("Pro is marked as your plan", (await text(page)).includes("Your plan"));
  const token = (await page.cookies()).find((c) => c.name === "docket_session")?.value;
  guestId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;

  // Once per plan: Basic grants its credits, going back to Pro grants nothing.
  for (const name of ["Basic", "Pro"]) {
    await clickExact(page, "main button", `Choose ${name}`);
    await page.waitForSelector("dialog[open] #cc-number");
    await clickStarts(page, "dialog[open] button", "Complete demo checkout");
    await page.waitForFunction((n) => document.querySelector("dialog[open]")?.innerText.includes(`${n} is your plan now`), { timeout: 20000 }, name).catch(async (e) => {
      console.log("DEBUG sheet:", (await text(page, "dialog[open]")).replace(/\s+/g, " ").slice(0, 400));
      throw e;
    });
    if (name === "Pro") {
      const again = await text(page, "dialog[open]");
      check("back to Pro: 'already added to this account once', no new credits", again.includes("already added to this account once") && !again.includes("+600"));
    }
    await clickExact(page, "dialog[open] button", "Done");
  }
  check("balance 700 + 120 (Basic, once) = 820", (await text(page, '[data-testid="balance"]')).startsWith("820"), await text(page, '[data-testid="balance"]'));

  await page.goto(`${base}/log?view=list`, { waitUntil: "networkidle0" });
  const ledger = await text(page);
  check("the log's list view records each grant", ledger.includes("Plan credits, demo checkout") && ledger.includes("+600") && ledger.includes("+120") && ledger.includes("820 after"));

  const leaked = sent.filter((s) => /4242|Demo Tester|12\/34|"cvc"|"number"|"expiry"/i.test(s));
  check("no request carried card details", leaked.length === 0, leaked[0]?.slice(0, 120) ?? `${sent.length} requests checked`);

  // Auth screens: rendering and server-side errors (no real credentials involved).
  const fresh = await browser.createBrowserContext();
  const ap = await fresh.newPage();
  await ap.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await ap.goto(`${base}/sign-in`, { waitUntil: "networkidle0" });
  await ap.type("#email", `nobody-${Date.now()}@example.test`);
  await ap.type("#password", "not-a-real-password");
  await clickExact(ap, "main button[type=submit]", "Sign in");
  await ap.waitForFunction(() => document.querySelector("main").innerText.includes("Email or password is incorrect"), { timeout: 15000 }).catch(() => {});
  check("sign in: a wrong email/password says so, and keeps the email", (await text(ap)).includes("Email or password is incorrect") && (await ap.$eval("#email", (i) => i.value)).startsWith("nobody-"));
  await shot(ap, "6-sign-in");
  await ap.goto(`${base}/sign-up`, { waitUntil: "networkidle0" });
  await ap.type("#email", `someone-${Date.now()}@example.test`);
  await ap.type("#password", "short");
  await clickExact(ap, "main button[type=submit]", "Create the account");
  await ap.waitForFunction(() => document.querySelector("#password-error"), { timeout: 15000 }).catch(() => {});
  check("create an account: a short password is refused next to the field", (await text(ap)).includes("Use at least 8 characters.") && !!(await ap.$("#password[aria-invalid=true]")));
  check("auth screens: no horizontal overflow", (await ap.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(ap, "7-sign-up");
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
  if (guestId) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/test-account.ts", "delete", guestId], { stdio: "ignore" });
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
