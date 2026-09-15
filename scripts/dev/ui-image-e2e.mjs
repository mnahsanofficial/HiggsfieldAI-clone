// The step-4 checkpoint as a stranger, through the real UI:
// open /ai/image signed out -> type a prompt -> Generate -> a real image lands in History
// -> header credits went down -> lightbox opens. Optionally saves screenshots.
// usage: node scripts/dev/ui-image-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , base, shotDir, flag] = process.argv;
const mobile = flag === "--mobile";
const W = mobile ? 390 : 1440;
const H = mobile ? 844 : 900;
const tag = mobile ? "mobile" : "desktop";
const results = [];
const check = (name, ok, info = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
const shot = async (page, name) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${tag}.png` });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-ui-")), args: ["--no-first-run", "--disable-extensions"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });

  await page.goto(`${base}/ai/image`, { waitUntil: "networkidle0", timeout: 60000 });
  check("signed out: /ai/image renders the empty state", await page.evaluate(() => document.body.innerText.includes("START CREATING WITH")));
  check("no horizontal overflow (empty)", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  const disabled = await page.$eval("form button[type=submit]", (b) => b.disabled);
  const priceShown = await page.$eval("form button[type=submit]", (b) => b.innerText.replace(/\s+/g, " "));
  check("Generate disabled with empty prompt but price visible", disabled && /2\.5\s*2/.test(priceShown), priceShown);
  await shot(page, "1-empty");

  const prompt = `a red paper boat sailing through a flooded neon arcade at night, cinematic ${Date.now()}`;
  await page.type("#prompt", prompt);
  await shot(page, "2-typed");
  const t0 = Date.now();
  await page.click("form button[type=submit]");

  await page.waitForFunction(() => document.body.innerText.includes("Generating") || document.body.innerText.includes("Queued"), { timeout: 30000 });
  check("pending tile with progress appears", true, `${Date.now() - t0}ms`);
  await shot(page, "3-pending");

  await page.waitForFunction((p) => [...document.querySelectorAll("main img")].some((i) => i.alt === p && i.complete && i.naturalWidth > 0), { timeout: 90000 }, prompt);
  check("real image appears in History", true, `${((Date.now() - t0) / 1000).toFixed(1)}s after click`);
  const img = await page.evaluate((p) => { const i = [...document.querySelectorAll("main img")].find((x) => x.alt === p); return { src: i.getAttribute("src"), w: i.naturalWidth, h: i.naturalHeight }; }, prompt);
  check("image served from /media and square", img.src.startsWith("/media/generations/") && img.w === 1024 && img.h === 1024, `${img.src.slice(0, 30)}… ${img.w}x${img.h}`);

  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "98", { timeout: 15000 }).catch(() => {});
  const bal = await page.$eval('a[href="/credits"]', (a) => a.innerText.trim()).catch(() => "missing");
  check("header balance went from 100 to 98", bal === "98", `header shows ${bal}`);
  check("no horizontal overflow (history)", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "4-history");

  await page.evaluate((p) => [...document.querySelectorAll("main img")].find((x) => x.alt === p).closest("button").click(), prompt);
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  const dialog = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check("lightbox shows prompt, model and 'MODEL GENERATED' label", dialog.includes(prompt) && dialog.includes("FLUX.1 [schnell]") && dialog.includes("MODEL GENERATED"));
  await shot(page, "5-lightbox");
  await page.keyboard.press("Escape");

  await page.goto(`${base}/credits`, { waitUntil: "networkidle0" });
  const credits = await page.evaluate(() => document.body.innerText);
  check("/credits ledger shows the 2-credit generation charge", credits.includes("Generation") && credits.includes("−2"));
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
