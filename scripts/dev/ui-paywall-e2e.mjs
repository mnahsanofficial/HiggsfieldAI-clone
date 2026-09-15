// Paywall as a guest through the real UI: spend credits down with two 1080p renders, the third
// Generate opens "Upgrade plan to buy credits" with the real shortfall, Demo Pro adds 600 credits,
// Generate then succeeds, and /credits shows the demo grant. Optionally saves screenshots.
// usage: node scripts/dev/ui-paywall-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , base, shotDir, flag] = process.argv;
const mobile = flag === "--mobile";
const tag = mobile ? "mobile" : "desktop";
const results = [];
const check = (name, ok, info = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
const shot = async (page, name) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${tag}.png` });
const clickText = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.innerText.includes(x)); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
const balance = (page) => page.$eval('a[href="/credits"]', (a) => a.innerText.trim()).catch(() => "?");
const doneCount = (page) => page.$$eval('main .columns-2 button video[src^="/media/renders/"]', (v) => v.length);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-uip-")), args: ["--no-first-run", "--disable-extensions"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/ai/video`, { waitUntil: "networkidle2", timeout: 60000 });
  await clickText(page, "aside button", "Add image");
  await page.waitForSelector('[role="dialog"] img');
  await clickText(page, '[role="dialog"] [role="tab"]', "Library");
  await page.evaluate(() => document.querySelectorAll('[role="dialog"] .columns-3 button')[5].click());
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await clickText(page, 'aside [role="radio"]', "1080p");

  for (let i = 1; i <= 2; i++) {
    await clickText(page, "aside button", "Generate");
    await page.waitForFunction((n) => document.querySelectorAll('main .columns-2 button video[src^="/media/renders/"]').length >= n, { timeout: 120000 }, i);
  }
  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "10", { timeout: 15000 }).catch(() => {});
  check("two 1080p renders spent 90 of 100 credits", (await balance(page)) === "10" && (await doneCount(page)) === 2, `balance ${await balance(page)}`);

  await clickText(page, "aside button", "Generate");
  await page.waitForSelector('[role="dialog"][aria-label="Upgrade plan"]', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] button').length > 3, { timeout: 15000 });
  const modal = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check("402 opens 'Upgrade plan to buy credits' with the real shortfall", modal.includes("UPGRADE PLAN TO BUY CREDITS") && modal.includes("costs 45 credits and you have 10"), modal.slice(0, 120).replace(/\s+/g, " "));
  check("plans translate credits into outcomes and say no payment is taken", modal.includes("= 300 FLUX.1 [schnell] images") && modal.includes("No payment taken"));
  await shot(page, "1-paywall");

  await clickText(page, '[role="dialog"] button', "Get Pro");
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.innerText.includes("Pro is active"), { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "610", { timeout: 15000 }).catch(() => {});
  check("Demo Pro adds 600 credits (balance 610)", (await balance(page)) === "610", `balance ${await balance(page)}`);
  await shot(page, "2-upgraded");
  await page.keyboard.press("Escape");

  await clickText(page, "aside button", "Generate");
  await page.waitForFunction(() => document.querySelectorAll('main .columns-2 button video[src^="/media/renders/"]').length >= 3, { timeout: 120000 });
  check("the refused generation now succeeds", (await doneCount(page)) === 3);

  await page.goto(`${base}/credits`, { waitUntil: "networkidle2" });
  const credits = await page.evaluate(() => document.body.innerText);
  check("/credits shows the demo plan grant", credits.includes("Plan credits") && credits.includes("Pro plan (demo: no payment taken)") && credits.includes("+600"));
  await page.goto(`${base}/pricing`, { waitUntil: "networkidle2" });
  check("/pricing marks Pro as the current plan; no overflow", (await page.evaluate(() => document.body.innerText)).includes("Current plan") && (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "3-pricing");
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
