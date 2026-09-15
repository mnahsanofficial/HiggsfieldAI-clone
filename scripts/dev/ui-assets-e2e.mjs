// Assets as a stranger through the real UI: /assets signed out -> guest -> 6 labelled examples
// -> filter -> lightbox (Example badge, Animate, Reuse) -> Reuse prefills /ai/image -> delete with
// confirmation survives reload. Optionally saves screenshots.
// usage: node scripts/dev/ui-assets-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const imagesDecoded = (page, scope) =>
  page.waitForFunction((sc) => { const imgs = [...document.querySelectorAll(`${sc} img`)]; return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0); }, { timeout: 20000 }, scope).then(() => true, () => false);
const tiles = (page) => page.$$eval("main .columns-2 > button", (b) => b.length);
const clickText = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.innerText.includes(x)); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-uia-")), args: ["--no-first-run", "--disable-extensions"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/assets`, { waitUntil: "networkidle2", timeout: 60000 });
  check("signed out: /assets invites a one-click guest session", (await page.evaluate(() => document.body.innerText)).includes("YOUR ASSETS LIVE HERE"));
  await page.click("main form button[type=submit]");
  await page.waitForSelector("main .columns-2 > button", { timeout: 30000 });
  const n = await tiles(page);
  const examples = await page.$$eval("main .columns-2 > button", (b) => b.filter((x) => x.innerText.includes("EXAMPLE")).length);
  check("guest lands on Assets with 6 examples, all badged Example", n === 6 && examples === 6, `${n} tiles, ${examples} badged`);
  check("no horizontal overflow; header nav unclipped", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0 && (await page.evaluate(() => { const nav = document.querySelector("header nav"); return nav.scrollWidth <= nav.clientWidth + 1; })));
  check("every tile's image actually decodes", await imagesDecoded(page, "main .columns-2"));
  await shot(page, "1-assets");

  await clickText(page, '[role="tab"]', "Videos");
  check("Videos filter shows the empty state with a create link", (await page.evaluate(() => document.querySelector("main").innerText)).includes("Create a video"));
  await clickText(page, '[role="tab"]', "All");

  await page.evaluate(() => document.querySelector("main .columns-2 > button").click());
  await page.waitForSelector('[role="dialog"]');
  const dialog = await page.$eval('[role="dialog"]', (d) => d.innerText);
  check("lightbox: Example badge, MODEL GENERATED, Animate, Reuse, Delete", ["Example from the library", "MODEL GENERATED", "Animate", "Reuse", "Delete"].every((t) => dialog.includes(t)));
  check("lightbox image decodes", await imagesDecoded(page, '[role="dialog"]'));
  await shot(page, "2-lightbox");
  const prompt = await page.$eval('[role="dialog"] aside p.text-sm', (p) => p.innerText);
  await clickText(page, '[role="dialog"] a', "Reuse");
  await page.waitForFunction(() => location.pathname === "/ai/image", { timeout: 15000 });
  await page.waitForSelector("#prompt");
  check("Reuse opens /ai/image with the prompt prefilled", (await page.$eval("#prompt", (t) => t.value)) === prompt);

  await page.goto(`${base}/assets`, { waitUntil: "networkidle2" });
  await page.evaluate(() => document.querySelector("main .columns-2 > button").click());
  await page.waitForSelector('[role="dialog"]');
  await clickText(page, '[role="dialog"] button', "Delete");
  check("first Delete tap only asks for confirmation", (await page.$eval('[role="dialog"]', (d) => d.innerText)).includes("Tap again to delete"));
  await clickText(page, '[role="dialog"] button', "Tap again to delete");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 15000 });
  check("confirmed delete removes the tile", (await tiles(page)) === 5);
  await page.reload({ waitUntil: "networkidle2" });
  check("deletion persists after reload", (await tiles(page)) === 5);
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
