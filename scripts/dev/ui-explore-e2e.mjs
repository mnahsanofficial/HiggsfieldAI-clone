// Explore as a stranger and as a guest: density, no horizontal overflow, images decode, and
// NO DEAD LINKS: every <a href> on the page is requested and must return 200. Full-page shots.
// usage: node scripts/dev/ui-explore-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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

async function audit(page, label) {
  await page.goto(`${base}/`, { waitUntil: "networkidle2", timeout: 60000 });
  // scroll through so lazy images and on-screen videos load
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await page.waitForFunction(() => [...document.querySelectorAll("main img")].every((i) => i.complete), { timeout: 30000 }).catch(() => {});
  const stats = await page.evaluate(() => ({
    imgs: document.querySelectorAll("main img").length,
    broken: [...document.querySelectorAll("main img")].filter((i) => i.complete && i.naturalWidth === 0).length,
    videos: document.querySelectorAll("main video").length,
    sections: document.querySelectorAll("main section").length,
    overflow: document.documentElement.scrollWidth - innerWidth,
    links: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))],
    strip: document.querySelector("main > div")?.innerText.replace(/\s+/g, " "),
  }));
  check(`${label}: dense first load (images, videos, sections)`, stats.imgs >= 60 && stats.videos >= 14 && stats.sections >= 10, `${stats.imgs} imgs, ${stats.videos} videos, ${stats.sections} sections`);
  check(`${label}: no broken images`, stats.broken === 0, `${stats.broken} broken`);
  check(`${label}: no horizontal overflow`, stats.overflow === 0, `${stats.overflow}px`);
  const internal = stats.links.filter((h) => h.startsWith("/"));
  const external = stats.links.filter((h) => !h.startsWith("/"));
  const statuses = await page.evaluate(async (hrefs) => Promise.all(hrefs.map(async (h) => [h, (await fetch(h, { redirect: "manual" })).status])), internal);
  const dead = statuses.filter(([, s]) => s !== 200);
  check(`${label}: every link resolves (no dead links)`, dead.length === 0 && external.length === 0, `${internal.length} unique internal links; dead: ${JSON.stringify(dead)}; external: ${external.length}`);
  // Chrome full-page captures wrap past ~16,000px, so capture clipped bands instead.
  if (shotDir) {
    const vw = mobile ? 390 : 1440;
    const band = mobile ? 2400 : 1800;
    for (const [i, top] of [0, band, band * 2].entries()) {
      await page.screenshot({ path: `${shotDir}/explore-${label}-${tag}-${i + 1}.png`, clip: { x: 0, y: top, width: vw, height: band } });
    }
  }
  return stats;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-uie-")), args: ["--no-first-run", "--disable-extensions", "--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const out = await audit(page, "signed-out");
  check("signed-out strip offers free credits", (out.strip ?? "").includes("100 free credits"));
  // Become a guest via the promo card, then audit the signed-in variant of the same page.
  await page.goto(`${base}/`, { waitUntil: "networkidle2" });
  await page.evaluate(() => [...document.querySelectorAll("main form button[type=submit]")][0].click());
  await page.waitForFunction(() => location.pathname === "/ai/image", { timeout: 30000 });
  const inn = await audit(page, "guest");
  check("guest strip shows the balance and 'Keep your work'", (inn.strip ?? "").includes("Guest session") && (inn.strip ?? "").includes("Keep your work"));
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
