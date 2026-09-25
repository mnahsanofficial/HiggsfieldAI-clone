// Home through the real UI, as a stranger on a fixture-mode server (IMAGE_PROVIDER=fixture, so
// the shared daily allowance is never spent): the headline says what Docket is, the make box
// shows the real allowance and price, the public log shows library entries media-first with a
// list toggle, making an image from home lands the run on /make, and home then shows it as
// yours. Deletes its guest afterwards.
// usage: node scripts/dev/ui-home-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const text = (page) => page.$eval("main", (m) => m.innerText);
const clickExact = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === x); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);

let guestId = null;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-home-")), args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("[data-entry]");
  const home = await text(page);
  if (!(await page.$eval("[data-quota]", (e) => e.innerText)).startsWith("Test mode")) throw new Error("server isn't in fixture mode: refusing to spend the real image allowance");
  check("headline says what Docket is", home.includes("Make an image, then move the camera over it") && home.includes("FLUX.1 [schnell]") && home.includes("14 camera moves") && home.includes("ffmpeg"));
  check("the make box shows the price, and the starter states its limits", home.includes("Costs 2") && (await page.$eval('[data-testid="starter"]', (e) => e.innerText)).includes("100 free credits, up to 5 images a day and 1 live camera move"));
  check("signed out: the public log, library entries, media first", home.includes("The public log") && (await page.$$("[data-entry] img")).length >= 6);
  check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-home");

  await clickExact(page, "label span", "List");
  await new Promise((r) => setTimeout(r, 400));
  check("list view on request", (await page.$$("main ol li a[href^='/log/']")).length >= 6);
  await shot(page, "2-home-list");
  await clickExact(page, "label span", "Media");

  await page.type("#home-prompt", `a stack of hand-bound notebooks tied with red string ${Date.now()}`);
  await clickExact(page, "form button[type=submit]", "Make the image");
  await page.waitForFunction(() => location.pathname === "/make", { timeout: 30000 });
  await page.waitForSelector("[data-entry]");
  check("making from home lands the run on /make", (await page.$eval("[data-entry]", (e) => e.innerText)).includes("hand-bound notebooks"));
  const token = (await page.cookies()).find((c) => c.name === "docket_session")?.value;
  guestId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
  await page.waitForFunction(() => !document.querySelector('[data-entry][aria-busy="true"]'), { timeout: 60000 });

  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector("[data-entry]");
  const back = await text(page);
  check("home now shows your latest runs, private unless published", back.includes("Your latest runs") && back.includes("hand-bound notebooks") && back.includes("Private unless you publish them") && back.includes("You can make 4 more today"));
  await shot(page, "3-home-yours");
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
  if (guestId) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/test-account.ts", "delete", guestId], { stdio: "ignore" });
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
