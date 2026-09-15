// Skeleton loaders through the real UI, with /media responses (and, for route transitions, RSC
// navigations) held back so the loading states are observable:
//  - Explore tiles show a skeleton in the tile's own aspect ratio, and the shimmer stops once loaded
//  - route loading states (Assets, Image studio, Pricing) render while the server responds
//  - the pending card keeps its real progress bar over the accent skeleton
//  - History tiles, the Assets grid and the lightbox show aspect-matched skeletons until media paints
// usage: node scripts/dev/ui-skeletons-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
import puppeteer from "puppeteer-core";
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hold = { media: false, rsc: false };
const held = [];
const release = () => {
  hold.media = hold.rsc = false;
  for (const r of held.splice(0)) r.continue().catch(() => {});
};

// Skeleton tiles whose box matches the aspect ratio the tile declares (within 2%).
const skeletonTiles = (page, scope) =>
  page.evaluate((sel) => {
    const out = { total: 0, matching: 0 };
    for (const el of document.querySelectorAll(`${sel} .skeleton`)) {
      const box = el.closest("[style*='aspect-ratio']") ?? el;
      const ar = box.style.aspectRatio;
      if (!ar) continue;
      const [w, h] = ar.split("/").map(Number);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      out.total++;
      if (Math.abs(r.width / r.height - w / h) / (w / h) < 0.02) out.matching++;
    }
    return out;
  }, scope);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-sk-")), args: ["--no-first-run", "--disable-extensions"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    const url = r.url();
    if ((hold.media && url.includes("/media/")) || (hold.rsc && r.headers()["rsc"] === "1" && !r.headers()["next-router-prefetch"])) held.push(r);
    else r.continue().catch(() => {});
  });

  // 1. Explore: tiles are aspect-matched skeletons while media is held.
  hold.media = true;
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("main section .skeleton", { timeout: 30000 });
  await sleep(600);
  const ex = await skeletonTiles(page, "main");
  check("Explore: media tiles render as skeletons matching their aspect ratio", ex.total >= 8 && ex.matching === ex.total, `${ex.matching}/${ex.total}`);
  check("Explore: no horizontal overflow while loading", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-explore-loading");
  release();
  const inView = () => [...document.querySelectorAll("main img")].filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0; });
  await page.waitForFunction(`(${inView})().length > 0 && (${inView})().every((i) => i.complete && i.naturalWidth > 0)`, { timeout: 60000 });
  await sleep(500);
  const stillShimmering = await page.evaluate(`(${inView})().filter((i) => i.classList.contains("skeleton")).length`);
  check("Explore: shimmer is removed once images load", stillShimmering === 0, `${stillShimmering} still shimmering`);

  // 2. Route loading state (loading.tsx) while the server responds.
  const navLoading = async (path, label) => {
    hold.rsc = true;
    // Client navigation through the Next router, like tapping a visible <Link>, which prefetches the
    // route's loading boundary first (on phones the /pricing nav item is hidden, so do it explicitly).
    await page.evaluate((p) => window.next?.router?.prefetch(p), path);
    await sleep(2000);
    await page.evaluate((p) => window.next?.router?.push(p), path);
    const shown = await page.waitForSelector(`main[aria-busy="true"][aria-label="${label}"]`, { timeout: 15000 }).then(() => true, () => false);
    return shown;
  };
  const assetsShown = await navLoading("/pricing", "Loading pricing");
  check("route loading: /pricing shows its skeleton (headline, toggle, 3 cards)", assetsShown);
  await shot(page, "2-pricing-route-loading");
  release();
  await page.waitForFunction(() => !document.querySelector('main[aria-busy="true"]') && location.pathname === "/pricing", { timeout: 30000 });

  // 3. Image studio: guest generates one image; the pending card keeps its progress bar.
  await page.goto(`${base}/ai/image`, { waitUntil: "networkidle2", timeout: 60000 });
  const prompt = `a tiny moss-covered robot reading under a desk lamp, soft film grain ${Date.now()}`;
  await page.type("#prompt", prompt);
  await page.click("form button[type=submit]");
  await page.waitForSelector("main .skeleton-accent", { timeout: 30000 });
  const pending = await page.evaluate(() => {
    const card = document.querySelector("main .skeleton-accent").parentElement;
    const [w, h] = card.style.aspectRatio.split("/").map(Number);
    const r = card.getBoundingClientRect();
    return { bar: !!card.querySelector(".bg-accent"), text: card.innerText, ratioOk: Math.abs(r.width / r.height - w / h) < 0.02 };
  });
  check("pending card: accent skeleton in the job's aspect, real progress bar kept", pending.bar && pending.ratioOk && /(Queued|Generating) · \d+%/.test(pending.text), pending.text.replace(/\s+/g, " ").slice(-40));
  await shot(page, "3-pending");
  await page.waitForFunction((p) => [...document.querySelectorAll("main img")].some((i) => i.alt === p && i.complete && i.naturalWidth > 0), { timeout: 90000 }, prompt);

  // 4. History tile + lightbox with media held.
  hold.media = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main .columns-2 .skeleton", { timeout: 30000 });
  const hist = await skeletonTiles(page, "main .columns-2");
  check("History: tile skeletons match the asset aspect ratio", hist.total >= 1 && hist.matching === hist.total, `${hist.matching}/${hist.total}`);
  await shot(page, "4-history-loading");
  await page.evaluate((p) => [...document.querySelectorAll("main img")].find((x) => x.alt === p).closest("button").click(), prompt);
  await page.waitForSelector('[role="dialog"] img.skeleton', { timeout: 10000 });
  const lb = await page.$eval('[role="dialog"] img', (i) => { const r = i.getBoundingClientRect(); return { w: r.width, h: r.height, skeleton: i.classList.contains("skeleton") }; });
  check("lightbox: full-size skeleton sized to the image (1:1) before it loads", lb.skeleton && lb.w > 150 && Math.abs(lb.w / lb.h - 1) < 0.02, `${Math.round(lb.w)}x${Math.round(lb.h)}`);
  await shot(page, "5-lightbox-loading");
  release();
  await page.waitForFunction(() => { const i = document.querySelector('[role="dialog"] img'); return i.complete && i.naturalWidth > 0 && !i.classList.contains("skeleton"); }, { timeout: 60000 });
  check("lightbox: skeleton cleared when the image paints", true);
  await page.keyboard.press("Escape");

  // 5. Assets: route skeleton, then tile skeletons.
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const assetsRoute = await navLoading("/assets", "Loading assets");
  check("route loading: /assets shows its skeleton (title, filters, grid)", assetsRoute);
  await shot(page, "6-assets-route-loading");
  hold.media = true;
  for (const r of held.splice(0)) r.continue().catch(() => {});
  hold.rsc = false;
  await page.waitForFunction(() => location.pathname === "/assets" && !document.querySelector('main[aria-busy="true"]'), { timeout: 30000 });
  await page.waitForSelector("main .columns-2 .skeleton", { timeout: 15000 });
  const as = await skeletonTiles(page, "main .columns-2");
  check("Assets: tile skeletons match the asset aspect ratio", as.total >= 1 && as.matching === as.total, `${as.matching}/${as.total}`);
  check("Assets: no horizontal overflow while loading", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "7-assets-loading");
  release();
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  release();
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
