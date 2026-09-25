// Audits the Docket design system in isolation on /style: contrast from the tokens, whether
// Public Sans's tabular figures align (deciding if a monospaced face is needed at all), visible
// keyboard focus, tap targets, reduced motion, skeleton shapes, the compare handle's keyboard
// control, and horizontal overflow. Saves screenshots.
// usage: node scripts/dev/design-system-check.mjs <baseUrl> [screenshotDir] [--mobile]
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

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-ds-")), args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/style`, { waitUntil: "load", timeout: 60000 }); // a looping take keeps streaming ranges, so the network never idles
  await page.evaluate(() => document.fonts.ready);

  check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);

  const font = await page.evaluate(() => {
    const fam = getComputedStyle(document.querySelector(".docket")).fontFamily;
    const loaded = [...document.fonts].some((f) => f.status === "loaded" && fam.includes(f.family.replace(/"/g, "")));
    return { fam: fam.split(",")[0], loaded };
  });
  check("Public Sans is loaded and applied (self-hosted)", font.loaded, font.fam);

  // Contrast for every colour used as text, on both grounds.
  const ratios = await page.$$eval("[data-contrast]", (els) =>
    els.map((e) => {
      const m = /on paper ([\d.]+):1, on field ([\d.]+):1/.exec(e.textContent);
      return { name: e.dataset.contrast, paper: Number(m[1]), field: Number(m[2]) };
    }),
  );
  const textColours = ["Ink", "Muted", "Posted", "Charged", "Live"]; // the only colours used as text
  const weak = ratios.filter((r) => textColours.includes(r.name) && (r.paper < 4.5 || r.field < 4.5));
  check("text colours reach 4.5:1 on paper and on field", weak.length === 0, ratios.filter((r) => textColours.includes(r.name)).map((r) => `${r.name} ${r.paper}/${r.field}`).join(", "));

  // The mono question: with tabular-nums, do Public Sans's digits share one advance width?
  const figures = await page.evaluate(() => {
    const probe = (variant) => {
      const widths = [];
      for (const d of "0123456789") {
        const s = document.createElement("span");
        s.textContent = d.repeat(8);
        s.style.cssText = `position:absolute;visibility:hidden;font:600 15px ${getComputedStyle(document.querySelector(".docket")).fontFamily};font-variant-numeric:${variant}`;
        document.body.appendChild(s);
        widths.push(s.getBoundingClientRect().width);
        s.remove();
      }
      return { min: Math.min(...widths), max: Math.max(...widths) };
    };
    return { tabular: probe("tabular-nums"), proportional: probe("proportional-nums") };
  });
  check(
    "Public Sans tabular figures share one width (no monospaced face needed)",
    figures.tabular.max - figures.tabular.min < 0.01 && figures.proportional.max - figures.proportional.min > 1,
    `tabular spread ${(figures.tabular.max - figures.tabular.min).toFixed(2)}px, proportional spread ${(figures.proportional.max - figures.proportional.min).toFixed(2)}px over 8 digits`,
  );

  // Keyboard focus is visible on everything interactive in <main>.
  await page.focus("body");
  const unfocusable = [];
  let seen = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !el.closest("main")) return null;
      const cs = getComputedStyle(el);
      const own = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
      // Native radios are visually hidden; their styled sibling shows the ring.
      const sib = el.nextElementSibling ? getComputedStyle(el.nextElementSibling) : null;
      const viaPeer = el.type === "radio" && sib && sib.outlineStyle !== "none" && parseFloat(sib.outlineWidth) >= 2;
      return { label: (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().slice(0, 30), ok: own || viaPeer };
    });
    if (!r) continue;
    seen++;
    if (!r.ok) unfocusable.push(r.label);
  }
  check("keyboard focus is visible on every control reached by Tab", seen >= 10 && unfocusable.length === 0, unfocusable.length ? unfocusable.join(" | ") : `${seen} controls`);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a, main label:has(input[type=radio]) span, main input:not([type=radio]), main textarea")]
      .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 32 || b.width < 32); })
      .map((e) => `${e.tagName}:${(e.textContent || e.id).trim().slice(0, 16)}`),
  );
  check("tap targets are at least 32px (radios measured by their visible label)", small.length === 0, small.join(", "));

  const shapes = await page.$$eval("[data-skeletons] .skeleton[style*='aspect-ratio']", (els) =>
    els.map((e) => { const [w, h] = e.style.aspectRatio.split("/").map(Number); const r = e.getBoundingClientRect(); return Math.abs(r.width / r.height - w / h) < 0.02; }),
  );
  check("skeletons hold their aspect ratio", shapes.length === 3 && shapes.every(Boolean));

  // The compare handle: keyboard-driven, never moving on its own.
  const handle = await page.$('[role="slider"]');
  const v0 = await handle.evaluate((h) => h.getAttribute("aria-valuenow"));
  await new Promise((r) => setTimeout(r, 1500));
  const v1 = await handle.evaluate((h) => h.getAttribute("aria-valuenow"));
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const v2 = await handle.evaluate((h) => h.getAttribute("aria-valuenow"));
  await page.keyboard.press("End");
  const v3 = await handle.evaluate((h) => h.getAttribute("aria-valuenow"));
  check("compare handle doesn't move on its own; arrows and End move it", v0 === "50" && v1 === "50" && v2 === "40" && v3 === "100", `${v0}, ${v1}, ${v2}, ${v3}`);
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");

  // The sheet: opens, traps Escape, and gives focus back.
  const opener = await page.evaluateHandle(() => [...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Open a sheet")));
  await opener.click();
  await page.waitForSelector("dialog[open]");
  const inDialog = await page.evaluate(() => !!document.activeElement.closest("dialog"));
  await new Promise((r) => setTimeout(r, 400)); // let the open animation finish before the screenshot
  if (shotDir) await page.screenshot({ path: `${shotDir}/sheet-${tag}.png` });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const back = await page.evaluate(() => document.activeElement.textContent.includes("Open a sheet"));
  check("sheet takes focus, closes on Escape, returns focus to its opener", inDialog && back);

  const busy = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("main button")].filter((b) => b.textContent.trim() === "Make the image");
    const p = btns.find((b) => b.getAttribute("aria-busy") === "true");
    const d = btns.find((b) => b.disabled && !b.getAttribute("aria-busy"));
    return { pending: getComputedStyle(p).opacity, disabled: getComputedStyle(d).opacity, bar: getComputedStyle(p, "::after").content };
  });
  check("pending button keeps full colour with a progress bar; disabled fades", busy.pending === "1" && Number(busy.disabled) < 0.6 && busy.bar !== "none", JSON.stringify(busy));

  if (shotDir) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const band = mobile ? 2400 : 1800;
    await page.evaluate(() => scrollTo(0, 0));
    for (let y = 0, i = 1; y < h; y += band, i++) await page.screenshot({ path: `${shotDir}/style-${tag}-${i}.png`, clip: { x: 0, y, width: mobile ? 390 : 1440, height: Math.min(band, h - y) }, captureBeyondViewport: true });
  }

  // Reduced motion: the take stops autoplaying and shows controls; the sheet doesn't slide.
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.reload({ waitUntil: "load" });
  const rm = await page.evaluate(() => {
    const v = document.querySelector('[role="slider"]').parentElement.querySelector("video");
    return { autoplay: v.autoplay, controls: v.controls, anim: getComputedStyle(document.querySelector(".skeleton")).animationDuration };
  });
  check("reduced motion: take doesn't autoplay, has controls; shimmer stops", !rm.autoplay && rm.controls && parseFloat(rm.anim) < 0.01, JSON.stringify(rm));
} finally {
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
