// Submission readiness, as a reviewer arriving cold: a fresh browser, no cookies, signed out, at
// 390 and 1440. Makes nothing (no images, no renders), so it's safe to point at production.
// Checks every page loads (and unknown paths get a real 404), no Higgsfield identity anywhere in
// titles or text, no horizontal overflow, tap targets, 16px controls on phones, images decode,
// the old URLs redirect to real Docket pages, /make shows the real allowance (not test mode), and
// browsing alone creates no session.
// usage: node scripts/dev/readiness.mjs <baseUrl> [screenshotDir]
import puppeteer from "puppeteer-core";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , base, shotDir] = process.argv;
const results = [];
const check = (name, ok, info = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`);
if (shotDir) mkdirSync(shotDir, { recursive: true });
const IDENTITY = /higgsfield|\bHF\b|soul id|genjutsu|cinema studio/i;

// 1. Old URLs, over plain HTTP.
const OLD = [
  ["/ai/image", "/make"],
  ["/ai/image?prompt=a%20red%20kite", "/make?prompt=a%20red%20kite"],
  ["/ai/video", "/make?mode=move"],
  ["/ai/video?preset=crash-zoom", "/make?mode=move&move=crash-zoom"],
  ["/ai/video?gallery=1", "/make?mode=move"],
  ["/assets", "/log"],
  ["/pricing", "/credits"],
  ["/credits", null],
  ["/login", "/sign-in"],
  ["/signup", "/sign-up"],
];
for (const [from, to] of OLD) {
  const r = await fetch(base + from, { redirect: "manual" });
  const loc = r.headers.get("location") ?? "";
  const final = await fetch(base + from);
  const landed = new URL(final.url);
  const ok = to === null ? r.status === 200 : [307, 308].includes(r.status) && landed.pathname === new URL(to, base).pathname && [...new URL(to, base).searchParams].every(([k, v]) => landed.searchParams.get(k) === v);
  check(`old URL ${from} lands on a real page`, ok && final.status === 200, `${r.status} -> ${landed.pathname}${landed.search} ${final.status}`);
  void loc;
}

// A library item's permalink, from the public log.
// Enough rows to reach past the published runs into the library.
const pub = await (await fetch(`${base}/api/log?scope=public&limit=20`)).json();
check("public log has real rows", pub.entries.length >= 6 && pub.entries.every((e) => e.assets[0]?.url?.startsWith("/media/")), `${pub.entries.length}`);
check("the allowance numbers are real, not test mode", pub.quota && pub.quota.testMode === false && pub.quota.siteCapacity === 57, JSON.stringify(pub.quota));

// Share previews: home, a published camera move, and a library image each carry og:title,
// og:description and a generated og:image that loads; titles are never cut mid-word.
const meta = (html, key) => (html.match(new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]+content="([^"]*)"`)) ?? [])[1] ?? null;
const move = pub.entries.find((e) => e.vertical === "video");
const longest = [...pub.entries].filter((e) => e.type === "library").sort((a, b) => b.prompt.length - a.prompt.length)[0];
for (const [name, path] of [["home", "/"], ["a published camera move", move ? `/log/${move.id}` : null], ["a library image", `/log/${longest.id}`]]) {
  if (!path) {
    check(`share preview: ${name}`, false, "none in the public log");
    continue;
  }
  const html = await (await fetch(base + path)).text();
  const [t, d, img, card] = [meta(html, "og:title"), meta(html, "og:description"), meta(html, "og:image"), meta(html, "twitter:card")];
  const imgRes = img ? await fetch(img.replace(/^https?:\/\/[^/]+/, base)) : null;
  const bytes = imgRes?.ok ? Buffer.from(await imgRes.arrayBuffer()) : Buffer.alloc(0);
  const png = bytes.subarray(1, 4).toString() === "PNG" ? { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) } : null;
  check(`share preview: ${name} has og:title, description, a 1200x630 image and a large card`, !!t && !!d && card === "summary_large_image" && png?.w === 1200 && png?.h === 630, `${t?.slice(0, 50)} | ${png ? `${png.w}x${png.h}` : imgRes?.status}`);
}
const titleHtml = await (await fetch(`${base}/log/${longest.id}`)).text();
const pageTitle = (titleHtml.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
const bare = pageTitle.replace(/ · Docket$/, "").replace(/&#x27;|&amp;/g, "'");
check("a long prompt's title ends at a word boundary with an ellipsis", longest.prompt.length <= 60 || (bare.endsWith("…") && longest.prompt.startsWith(bare.slice(0, -1)) && [" ", ","].includes(longest.prompt[bare.length - 1] ?? " ")), `${bare} (${longest.prompt.length} chars)`);

const PAGES = [
  ["/", 200],
  ["/make", 200],
  ["/log", 200],
  ["/credits", 200],
  ["/sign-in", 200],
  ["/sign-up", 200],
  [`/log/${pub.entries[0].id}`, 200],
  ["/style", 200],
  ["/this-page-does-not-exist", 404],
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-ready-")), args: ["--no-first-run"] });
try {
  for (const [w, h, tag] of [[390, 844, "mobile"], [1440, 900, "desktop"]]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const [path, status] of PAGES) {
      const res = await page.goto(base + path, { waitUntil: "load", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 600));
      const r = await page.evaluate((mobile) => {
        const inView = [...document.querySelectorAll("img")].filter((i) => { const b = i.getBoundingClientRect(); return b.width > 0 && b.top < innerHeight && b.bottom > 0; });
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          text: document.title + "\n" + document.body.innerText,
          wordmark: document.querySelector("header a")?.textContent.trim(),
          broken: inView.filter((i) => i.complete && i.naturalWidth === 0).length,
          small: [...document.querySelectorAll("a, button, input:not([type=radio]), textarea, label:has(input[type=radio]) span")]
            .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 32 || b.width < 32) && getComputedStyle(e).position !== "absolute" && !e.closest(".sr-only"); })
            .map((e) => `${e.tagName}:${(e.textContent || e.id).trim().slice(0, 18)}`),
          tinyControls: mobile ? [...document.querySelectorAll("input, textarea, select")].filter((e) => e.type !== "radio" && e.type !== "hidden" && e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id) : [],
        };
      }, w < 500);
      const name = `${tag} ${path.length > 30 ? "/log/<library item>" : path}`;
      check(`${name}: ${status}, Docket, no overflow, no broken images`, res.status() === status && r.wordmark === "Docket" && r.overflow === 0 && r.broken === 0, `${res.status()} overflow ${r.overflow} broken ${r.broken}`);
      check(`${name}: no trace of the old identity`, !IDENTITY.test(r.text), (r.text.match(IDENTITY) ?? [""])[0]);
      check(`${name}: tap targets >= 32px, phone controls >= 16px`, r.small.length === 0 && r.tinyControls.length === 0, [...r.small, ...r.tinyControls].join(", "));
      if (shotDir) await page.screenshot({ path: `${shotDir}/${path === "/" ? "home" : path.replace(/^\//, "").replace(/\//g, "-").slice(0, 40)}-${tag}.png` });
    }
    await page.goto(`${base}/make`, { waitUntil: "load" });
    // With no images left today, /make opens on camera moves; the image form still states the count.
    if (Math.min(pub.quota.siteLeft, pub.quota.yoursLeft) === 0) {
      const mode = await page.$eval('main form input[name="mode"]:checked', (i) => i.value).catch(() => null);
      check(`${tag} /make: out of images, it opens in camera-move mode`, mode === "move", `${mode}`);
      await page.evaluate(() => [...document.querySelectorAll("main form label")].find((l) => l.textContent.trim() === "Image")?.click());
      await page.waitForSelector("[data-quota]", { timeout: 5000 }).catch(() => {});
    }
    const allowance = await page.$eval("[data-quota]", (e) => e.innerText).catch(() => "");
    check(`${tag} /make: the allowance line shows real numbers`, allowance.length > 0 && !allowance.startsWith("Test mode") && /(free images? left today|No free images left today)/.test(allowance), allowance.slice(0, 90));
    check(`${tag}: browsing created no session`, !(await page.cookies()).some((c) => /session/.test(c.name)));
    check(`${tag}: no page errors`, errors.length === 0, errors[0]);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(results.join("\n"));
console.log(`${results.filter((r) => r.startsWith("PASS")).length} passed, ${results.filter((r) => r.startsWith("FAIL")).length} failed`);
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
