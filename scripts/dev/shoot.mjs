// Screenshots at true device viewports, optionally as a fresh guest.
// usage: node scripts/dev/shoot.mjs <outDir> <baseUrl> <guest:0|1> name|width|height|path [...]
// Reports horizontal overflow per capture (must be 0 at 390px).
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , outDir, base, guest, ...specs] = process.argv;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), "hf-shoot-")),
  args: ["--no-first-run", "--no-default-browser-check", "--disable-extensions"],
});
const page = await browser.newPage();
if (guest === "1") {
  await page.goto(base + "/", { waitUntil: "networkidle0" });
  await page.click("form button[type=submit]");
  await page.waitForFunction(() => !!document.querySelector('a[href="/credits"]'), { timeout: 30000 });
}
for (const spec of specs) {
  const [name, w, h, path] = spec.split("|");
  const mobile = +w < 768;
  await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(base + path, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 500));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`${name}: ${w}px overflow ${overflow}px`);
}
await browser.close();
