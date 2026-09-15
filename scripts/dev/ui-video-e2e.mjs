// Video flow as a stranger through the real UI: /ai/video signed out -> preset gallery ->
// pick a preset -> add a library image -> Generate -> rendered MP4 in History -> credits down
// -> lightbox labels it a rendered camera move. Optionally saves screenshots.
// usage: node scripts/dev/ui-video-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const clickText = (page, selector, text) =>
  page.evaluate((sel, t) => { const el = [...document.querySelectorAll(sel)].find((e) => e.innerText.includes(t)); if (!el) throw new Error(`no ${sel} with ${t}`); el.click(); }, selector, text);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-uiv-")), args: ["--no-first-run", "--disable-extensions", "--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  if (process.env.E2E_DEBUG) page.on("response", async (r) => { if (r.url().includes("/api/jobs") && r.request().method() === "POST") console.log(`  [debug] POST /api/jobs ${r.status()} ${(await r.text().catch(() => "")).slice(0, 180)}`); });
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/ai/video`, { waitUntil: "networkidle2", timeout: 60000 });
  const text = await page.evaluate(() => document.body.innerText);
  check("signed out: /ai/video shows 'How it works' and the preset card", text.includes("MAKE VIDEOS IN ONE CLICK") && text.includes("GENERAL"));
  check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  const btn = await page.evaluate(() => [...document.querySelectorAll("aside button")].at(-1).innerText.replace(/\s+/g, " "));
  check("Generate prompts for an image and shows the price (53.5 struck, 30)", btn.includes("Add image") && /53\.5\s*30/.test(btn), btn);
  await shot(page, "1-studio");

  await clickText(page, "aside button", "Change");
  await page.waitForSelector('[role="dialog"][aria-label="Choose a preset"]');
  const cards = await page.$$eval('[role="dialog"] video', (v) => v.length);
  check("preset gallery shows 14 real preview videos", cards === 14, `${cards} videos`);
  const badged = await page.$$eval('[role="dialog"] button', (b) => b.filter((x) => x.innerText.includes("PRE-RENDERED")).length);
  check("the 4 expensive moves (arcs, rack focus) are badged PRE-RENDERED", badged === 4, `${badged}`);
  await clickText(page, '[role="dialog"] [role="tab"]', "Pan & tilt");
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "2-presets");
  await clickText(page, '[role="dialog"] button', "PAN RIGHT");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  check("picked preset shows on the card", (await page.evaluate(() => document.querySelector("aside").innerText)).includes("PAN RIGHT"));

  await clickText(page, "aside button", "Add image");
  await page.waitForSelector('[role="dialog"][aria-label="Add an image"]');
  await clickText(page, '[role="dialog"] [role="tab"]', "Library");
  await page.waitForSelector('[role="dialog"] img');
  await shot(page, "3-picker");
  await page.evaluate(() => document.querySelectorAll('[role="dialog"] .columns-3 button')[3].click());
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));

  const t0 = Date.now();
  await clickText(page, "aside button", "Generate");
  await page.waitForFunction(() => document.body.innerText.includes("Rendering") || document.body.innerText.includes("Queued"), { timeout: 30000 });
  check("pending render tile appears", true, `${Date.now() - t0}ms`);
  await shot(page, "4-pending");
  await page.waitForFunction(() => !!document.querySelector('main .columns-2 button video[src^="/media/renders/"]:not([src*="/library-"])'), { timeout: 120000 });
  check("rendered MP4 appears in History", true, `${((Date.now() - t0) / 1000).toFixed(1)}s after click`);
  await page.waitForFunction(() => document.querySelector('a[href="/credits"]')?.innerText.trim() === "70", { timeout: 15000 }).catch(() => {});
  check("header balance 100 -> 70", (await page.$eval('a[href="/credits"]', (a) => a.innerText.trim())) === "70");
  const media = await page.evaluate(async () => { const src = document.querySelector('main .columns-2 button video[src^="/media/renders/"]:not([src*="/library-"])').getAttribute("src"); const r = await fetch(src, { headers: { Range: "bytes=0-99" } }); return { status: r.status, type: r.headers.get("content-type") }; });
  check("MP4 serves byte ranges (206 video/mp4)", media.status === 206 && media.type === "video/mp4", JSON.stringify(media));
  await shot(page, "5-history");

  await page.evaluate(() => document.querySelector('main .columns-2 button video[src^="/media/renders/"]:not([src*="/library-"])').closest("button").click());
  await page.waitForSelector('[role="dialog"] video[controls]');
  const dialog = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check("lightbox labels the live render RENDERED CAMERA MOVE, not AI video", dialog.includes("RENDERED CAMERA MOVE") && dialog.includes("Not AI-generated video"));
  await new Promise((r) => setTimeout(r, 1500));
  await shot(page, "6-lightbox");
  await page.keyboard.press("Escape");

  // Free-tier compute limit: the guest's live render is used, so the next one is a labelled example.
  const next = await page.evaluate(() => [...document.querySelectorAll("aside button")].at(-1).innerText.replace(/\s+/g, " "));
  const note = await page.evaluate(() => document.querySelector("aside").innerText);
  check("after the live render, Generate reads 'Get example · Free' and says why", next.includes("Get example") && next.includes("FREE") && note.includes("used your live render"), next);
  await clickText(page, "aside button", "Get example");
  await page.waitForFunction(() => !!document.querySelector('main .columns-2 button video[src*="/media/renders/library-"]'), { timeout: 60000 });
  const tile = await page.evaluate(() => document.querySelector('main .columns-2 button video[src*="/media/renders/library-"]').closest("button").innerText);
  check("pre-rendered example appears, badged as such", tile.includes("PRE-RENDERED EXAMPLE"), tile.replace(/\s+/g, " "));
  await new Promise((r) => setTimeout(r, 1500));
  check("no credits charged for the example (balance still 70)", (await page.$eval('a[href="/credits"]', (a) => a.innerText.trim())) === "70");
  await page.evaluate(() => document.querySelector('main .columns-2 button video[src*="/media/renders/library-"]').closest("button").click());
  await page.waitForSelector('[role="dialog"] video[controls]');
  const exDialog = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check("example lightbox: PRE-RENDERED EXAMPLE, free-tier compute limit, no credits charged", exDialog.includes("PRE-RENDERED EXAMPLE") && exDialog.includes("compute") && exDialog.includes("No credits were charged"));
  await shot(page, "7-example");
} catch (err) {
  results.push(`FAIL  crashed: ${String(err).slice(0, 200)}`);
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
