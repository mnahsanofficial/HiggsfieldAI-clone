// Paywall + demo checkout as a guest through the real UI. The guest's balance is set to 1 credit
// through an `adjustment` ledger row (test setup; no renders or model calls spent), so Generate
// opens "Upgrade plan to buy credits" with the real shortfall. Then: Get Pro opens the labelled
// demo checkout with a test card; a bad card number and an invalid promo code are refused;
// " ahsan345 " takes the total to $0.00; completing checkout shows success and the header balance
// updates; the refused generation then succeeds; /credits shows the demo_topup. Every request the
// page makes is recorded, and none may contain card details. Optionally saves screenshots.
// usage: node scripts/dev/ui-paywall-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const clickText = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.innerText.includes(x)); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
const balance = (page) => page.$eval('a[href="/credits"]', (a) => a.innerText.trim()).catch(() => "?");
const text = (page, sel = "body") => page.$eval(sel, (d) => d.innerText).catch(() => "");
const setInput = async (page, sel, value) => {
  await page.click(sel, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.$eval(sel, (el) => { el.value = ""; });
  await page.type(sel, value);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-uip-")), args: ["--no-first-run", "--disable-extensions"] });
const sent = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  page.on("request", (r) => sent.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`));

  await page.goto(`${base}/ai/image`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => fetch("/api/auth/guest", { method: "POST" }));
  const token = (await page.cookies()).find((c) => c.name === "hf_session")?.value;
  const userId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
  execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/set-balance.ts", userId, "10"], { stdio: "ignore" });
  await page.reload({ waitUntil: "networkidle2" });
  check("guest set up with 1 credit", (await balance(page)) === "1", `header ${await balance(page)}`);

  await page.type("#prompt", `a lighthouse made of glass on a basalt cliff, storm light ${Date.now()}`);
  await page.click("form button[type=submit]");
  await page.waitForSelector('[role="dialog"][aria-label="Upgrade plan"]', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] button').length > 3, { timeout: 15000 });
  const modal = await text(page, '[role="dialog"]');
  check("402 opens 'Upgrade plan to buy credits' with the real shortfall", modal.includes("UPGRADE PLAN TO BUY CREDITS") && modal.includes("costs 2 credits and you have 1"), modal.slice(0, 120).replace(/\s+/g, " "));
  await shot(page, "1-paywall");

  await clickText(page, '[role="dialog"] button', "Get Pro");
  await page.waitForSelector("#cc-number", { timeout: 5000 });
  const checkout = await text(page, '[role="dialog"]');
  const prefilled = await page.$eval("#cc-number", (i) => i.value);
  check("checkout is labelled a demo with a prefilled test card", checkout.includes("DEMO CHECKOUT, NO REAL PAYMENT") && checkout.includes("never sent or stored") && prefilled === "4242 4242 4242 4242");
  check("card inputs have no name attribute (can't be form-submitted)", await page.$$eval("#cc-number,#cc-exp,#cc-cvc,#cc-name", (els) => els.every((e) => !e.name)));
  const fullTotal = await text(page, '[data-testid="checkout-total"]');
  await shot(page, "2-checkout");

  const plansPostsBefore = sent.filter((s) => s.startsWith("POST") && s.includes("/api/plans ")).length;
  await setInput(page, "#cc-number", "4242 4242 4242 4241");
  await setInput(page, "#cc-exp", "0120");
  await clickText(page, '[role="dialog"] button', "Complete demo checkout");
  await new Promise((r) => setTimeout(r, 500));
  const errs = await text(page, '[role="dialog"]');
  check("bad card number and expired date are refused in the browser, nothing posted", errs.includes("Enter a valid card number.") && errs.includes("This card has expired.") && sent.filter((s) => s.startsWith("POST") && s.includes("/api/plans ")).length === plansPostsBefore);

  await setInput(page, "#promo", "HIGGS50");
  await clickText(page, '[role="dialog"] button', "Apply");
  await page.waitForFunction(() => document.querySelector("#promo-error")?.innerText.includes("isn't valid"), { timeout: 10000 }).catch(() => {});
  check("any other promo code shows an invalid-code error", (await text(page, "#promo-error")).includes("isn't valid"));
  await shot(page, "3-errors");

  await setInput(page, "#cc-number", "4242424242424242");
  await setInput(page, "#cc-exp", "1234");
  await setInput(page, "#promo", "  ahsan345 ");
  await clickText(page, '[role="dialog"] button', "Apply");
  await page.waitForFunction(() => document.querySelector('[data-testid="checkout-total"]')?.innerText === "$0.00", { timeout: 10000 }).catch(() => {});
  const dlg = await text(page, '[role="dialog"]');
  check("' ahsan345 ' applies AHSAN345 (100% off): total $0.00", (await text(page, '[data-testid="checkout-total"]')) === "$0.00" && dlg.includes("AHSAN345 (100% off)") && fullTotal !== "$0.00", `was ${fullTotal}`);
  await shot(page, "4-promo");

  await clickText(page, '[role="dialog"] button', "Complete demo checkout");
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes("PRO IS ACTIVE"), { timeout: 20000 });
  check("success state: Pro is active, +600 credits", (await text(page, '[role="dialog"]')).includes("+600 credits"));
  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "601", { timeout: 15000 }).catch(() => {});
  check("header balance updates to 601", (await balance(page)) === "601", `header ${await balance(page)}`);
  await shot(page, "5-success");
  await page.keyboard.press("Escape");

  await page.click("form button[type=submit]");
  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "599", { timeout: 30000 }).catch(() => {});
  check("the refused generation is now accepted and charged (601 -> 599)", (await balance(page)) === "599", `header ${await balance(page)}`);

  await page.goto(`${base}/credits`, { waitUntil: "networkidle2" });
  const credits = await text(page);
  check("/credits shows the demo_topup with the promo and no payment", credits.includes("Plan credits (demo checkout)") && credits.includes("Pro plan: demo checkout with AHSAN345 (100% off), no payment taken") && credits.includes("+600"));
  await page.goto(`${base}/pricing`, { waitUntil: "networkidle2" });
  check("/pricing marks Pro as the current plan; no overflow", (await text(page)).includes("Current plan") && (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await clickText(page, "main button", "Get Max");
  await page.waitForSelector("#cc-number");
  check("/pricing checkout fits the viewport width", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "6-pricing-checkout");

  const leaked = sent.filter((s) => /4242|Demo Tester|12\/34|"cvc"|"number"|"expiry"/i.test(s));
  check("no request carried card details", leaked.length === 0, leaked.length ? leaked[0].slice(0, 120) : `${sent.length} requests checked`);
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
