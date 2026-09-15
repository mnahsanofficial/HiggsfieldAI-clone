// 390px audit of every surface: horizontal overflow, tap targets under 32px, and form controls
// under 16px text (iOS Safari zooms on focus). Saves a screenshot per surface; exits 1 on findings.
// usage: node scripts/dev/mobile-audit.mjs <baseUrl> <screenshotDir>
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const [, , base, out] = process.argv;
mkdirSync(out, { recursive: true });
let findings = 0;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: mkdtempSync(join(tmpdir(), "aud-")) });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const audit = async (name) => {
  const r = await page.evaluate(() => {
    const over = document.documentElement.scrollWidth - innerWidth;
    const small = [...document.querySelectorAll("a,button,input,select,textarea,[role=tab],[role=radio]")].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 32 || b.width < 32) && getComputedStyle(e).visibility !== "hidden"; }).map((e) => `${e.tagName}:${(e.innerText || e.getAttribute("aria-label") || e.id || "").trim().slice(0, 24)}(${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)})`);
    const inputsSmallFont = [...document.querySelectorAll("input,textarea,select")].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16 && e.getBoundingClientRect().width > 0).map((e) => e.id || e.name || e.tagName);
    return { over, small: small.slice(0, 12), smallCount: small.length, inputsSmallFont };
  });
  const bad = r.over > 0 || r.smallCount > 0 || r.inputsSmallFont.length > 0;
  if (bad) findings++;
  console.log(`${bad ? "FAIL" : "PASS"}  ${name}${bad ? "  " + JSON.stringify({ overflow: r.over, small: r.small, smallFontControls: r.inputsSmallFont }) : ""}`);
  await page.screenshot({ path: `${out}/${name}.png` });
};
for (const [n, p] of [["explore", "/"], ["image", "/ai/image"], ["video", "/ai/video"], ["pricing", "/pricing"], ["login", "/login"], ["signup", "/signup"], ["notfound", "/nope-404"], ["assets-out", "/assets"]]) {
  await page.goto(base + p, { waitUntil: "networkidle2", timeout: 60000 }); await audit(n);
}
await page.goto(base + "/ai/image", { waitUntil: "networkidle2" });
await page.evaluate(() => fetch("/api/auth/guest", { method: "POST" }));
for (const [n, p] of [["image-guest", "/ai/image"], ["video-guest", "/ai/video"], ["assets", "/assets"], ["credits", "/credits"]]) {
  await page.goto(base + p, { waitUntil: "networkidle2", timeout: 60000 }); await audit(n);
}
await page.goto(base + "/ai/video?gallery=1", { waitUntil: "networkidle2" }); await audit("preset-gallery");
await page.goto(base + "/ai/video", { waitUntil: "networkidle2" });
await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => b.innerText.includes("Add image")).click());
await page.waitForSelector('[role="dialog"] img'); await audit("image-picker");
await page.goto(base + "/pricing", { waitUntil: "networkidle2" });
await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.innerText.includes("Get Pro")).click());
await page.waitForSelector("#cc-number"); await audit("checkout");
await page.setViewport({ width: 390, height: 600, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(base + "/ai/image", { waitUntil: "networkidle2" }); await audit("image-short");
await browser.close();
console.log(findings ? `${findings} surface(s) with findings` : "all surfaces clean");
if (findings) process.exit(1);
