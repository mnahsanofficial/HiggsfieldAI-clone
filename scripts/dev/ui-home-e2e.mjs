// Home through the real UI, as a stranger on a fixture-mode server (IMAGE_PROVIDER=fixture, so
// the shared daily allowance is never spent). Home explains: the headline and who it's for, the
// real still-and-move pair, how it works as three real artifacts from one published run, what's
// real (with a link to a real record), what's free (read from the enforced values), one primary
// action, and a short strip of the public log. Then the public log page pages to the end without
// repeats, and a guest who has used today's images gets the camera move as the primary action.
// Deletes its guest afterwards.
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
const shot = async (page, name, fullPage = false) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${tag}.png`, fullPage });
const inner = (page, sel) => page.$eval(sel, (e) => e.innerText).catch(() => "");
const UUID = /^\/log\/[0-9a-f-]{36}$/;

let guestId = null;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "docket-home-")), args: ["--no-first-run"] });
try {
  const api = await (await fetch(`${base}/api/log?scope=public&limit=1`)).json();
  if (!api.quota?.testMode) throw new Error("server isn't in fixture mode: refusing to spend the real image allowance");
  const q = api.quota;

  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await page.goto(`${base}/`, { waitUntil: "networkidle0", timeout: 60000 });

  // 1. What it is, and who it's for.
  check("one h1, and it says what Docket is", (await page.$$eval("h1", (h) => h.map((x) => x.textContent.trim()))).join("|") === "Docket makes an image, then moves the camera over it.");
  check("the first HTML is the page itself (headline before any skeleton)", await (async () => { const html = await (await fetch(`${base}/`)).text(); const h1 = html.indexOf("<h1"); return h1 > 0 && !html.slice(0, h1).includes('aria-busy="true"'); })());
  const forLine = await inner(page, '[data-testid="home-for"]');
  const moveCount = Number(forLine.match(/pick one of (\d+) camera moves/)?.[1]);
  check("one plain sentence under it: who it's for and what they get", /^For anyone who wants/.test(forLine) && moveCount > 0 && /\d+-second \d+p clip/.test(forLine), forLine);

  // 2. The real pair, with the handle.
  check("the real still-and-move pair is the hero", !!(await page.$('[data-testid="home-pair"] [role="slider"]')) && (await inner(page, '[data-testid="home-pair"]')).includes("rendered with ffmpeg over a library still"));
  await page.focus('[data-testid="home-pair"] [role="slider"]');
  await page.keyboard.press("ArrowRight");
  check("the handle works from the keyboard", (await page.$eval('[data-testid="home-pair"] [role="slider"]', (s) => s.getAttribute("aria-valuenow"))) === "55");

  // 3. How it works: three steps, each a real artifact from one published run.
  const steps = await page.$$eval('[data-testid="how-it-works"] ol > li', (lis) =>
    lis.map((li) => ({ h: li.querySelector("h3")?.textContent.trim(), img: li.querySelector("img")?.getAttribute("src") ?? "", video: li.querySelector("video")?.getAttribute("src") ?? "", text: li.innerText, record: li.querySelector('a[href^="/log/"]')?.getAttribute("href") ?? "" })),
  );
  check("how it works: three steps, in order", steps.map((s) => s.h).join(" | ") === "1. Make an image | 2. Choose a camera move | 3. Every run stays on the record", steps.map((s) => s.h).join(" | "));
  check("step 1 is a real generated still, with its prompt", steps[0]?.img.startsWith("/media/") && /“.+”/.test(steps[0]?.text ?? ""));
  check("step 2 is a real camera move", steps[1]?.video.startsWith("/media/") && steps[1]?.text.includes(`one of the ${moveCount}`));
  check("step 3 is that run's receipt line: model, cost, refund, and a link to its record", /Model\s+Camera motion/.test(steps[2]?.text ?? "") && /Cost/.test(steps[2]?.text ?? "") && /Refund/.test(steps[2]?.text ?? "") && UUID.test(steps[2]?.record ?? ""), steps[2]?.text.replace(/\s+/g, " "));
  const recordRes = await fetch(`${base}${steps[2]?.record}`);
  const recordHtml = await recordRes.text();
  const move = (steps[2]?.text.match(/Move\s+(.+)/) ?? [])[1]?.trim();
  check("the receipt's record is public and is the same run", recordRes.status === 200 && !!move && recordHtml.includes(move), `${recordRes.status} ${move}`);

  // 4. What's real: three lines, one linked to a real public permalink.
  const real = await page.$$eval('[data-testid="whats-real"] li', (lis) => lis.map((l) => l.innerText));
  const proof = await page.$eval('[data-testid="proof-link"]', (a) => a.getAttribute("href"));
  check("what's real: FLUX.1 on Cloudflare, ffmpeg not AI video, every credit recorded", real.length === 3 && /FLUX\.1 \[schnell\] on Cloudflare/.test(real[0]) && /ffmpeg/.test(real[1]) && /not AI video/.test(real[1]) && /Every credit in and out is recorded/.test(real[2]));
  check("the proof line links to a real public permalink", UUID.test(proof) && (await fetch(`${base}${proof}`)).status === 200, proof);

  // 5. Free to start, read from the enforced values.
  const starter = await inner(page, '[data-testid="starter"]');
  const limits = await inner(page, '[data-testid="daily-limits"]');
  check("free to start: no account needed, the starter credits and the prices", /^No account needed: you start with \d+ free credits\. An image costs \d+ and a live camera move \d+\.$/.test(starter), starter);
  check("the daily limits are the enforced ones", limits.includes(`up to ${q.perVisitor} images a day, from ${q.siteCapacity} a day shared`) && /\d+ live camera moves? \(\d+ with an account\)/.test(limits), limits);

  // 6. One primary action, one secondary; no make box on home.
  const actions = await page.$$eval('[data-testid="home-actions"] a', (as) => as.map((a) => ({ t: a.textContent.trim(), href: a.getAttribute("href"), primary: a.className.includes("bg-ink") })));
  const primaries = await page.$$eval("main a, main button", (els) => els.filter((e) => e.className.includes("bg-ink") && !e.closest('[data-testid="home-pair"]')).length);
  check("one primary action, 'Start making' → /make, and a secondary to the public log", primaries === 1 && actions[0]?.t === "Start making" && actions[0]?.href === "/make" && actions[0]?.primary && actions[1]?.href === "/log?scope=public" && !actions[1]?.primary, JSON.stringify(actions));
  check("home has no make box: /make does the making", !(await page.$("main form")) && !(await page.$("textarea")));

  // 7. The public log is a short strip, with a way to all of it.
  const strip = await page.$$eval('[data-testid="public-strip"] li a', (as) => as.map((a) => a.getAttribute("href")));
  check("the public log is a short strip of about four entries, each a permalink", strip.length === 4 && strip.every((h) => UUID.test(h)), `${strip.length}`);
  check("the strip links to the whole public log", (await page.$$eval('[data-testid="public-strip"] a', (as) => as.some((a) => a.getAttribute("href") === "/log?scope=public" && a.textContent.trim() === "See all of it"))));
  check("nothing sells: no testimonials, stats or eyebrow labels", !/testimonial|trusted by|\d+\+|★/i.test(await inner(page, "main")));
  check("no horizontal overflow", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-home", true);

  // 8. The public log page: everything, paged without repeats.
  await page.goto(`${base}/log?scope=public`, { waitUntil: "networkidle0" });
  check("the public log page has its own heading and title", (await inner(page, "h1")) === "The public log" && (await page.title()).startsWith("The public log"));
  const before = await page.$$eval("[data-entry]", (es) => es.map((e) => e.getAttribute("data-entry")));
  await shot(page, "2-public-log");
  await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Show more")?.click());
  await page.waitForFunction((n) => document.querySelectorAll("[data-entry]").length > n, { timeout: 30000 }, before.length);
  const after = await page.$$eval("[data-entry]", (es) => es.map((e) => e.getAttribute("data-entry")));
  check("show more adds the next page, no repeats", after.length > before.length && new Set(after).size === after.length, `${before.length} → ${after.length}`);

  // 9. Out of today's images: the camera move becomes the primary action, the quota note under it.
  await page.goto(`${base}/`, { waitUntil: "load" });
  const g = await page.evaluate(async () => (await fetch("/api/auth/guest", { method: "POST" })).status);
  const token = (await page.cookies()).find((c) => c.name === "docket_session")?.value;
  guestId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
  for (let i = 0; i < q.perVisitor; i++) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/fixture-run.ts", guestId, `used up ${i}`], { stdio: "ignore" });
  await page.goto(`${base}/`, { waitUntil: "networkidle0" });
  const order = await page.$eval('[data-testid="home-actions"]', (b) => {
    const [a, second] = b.querySelectorAll("a");
    const note = b.querySelector("[data-quota]");
    return { primary: a?.textContent.trim(), noteUnderPrimary: !!(a && note && a.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING && second && note.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING), note: note?.innerText ?? "", secondary: second?.textContent.trim() };
  });
  check("out of images: 'Move the camera over a library image' is primary, the quota note right under it", g === 201 || g === 200 ? order.primary === "Move the camera over a library image" && order.noteUnderPrimary && order.note.includes("images for today") : false, JSON.stringify(order));
  check("a guest's free-to-start line shows their balance", /^You have \d+ credits\./.test(await inner(page, '[data-testid="starter"]')));
  await shot(page, "3-home-out-of-images", true);
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
  if (guestId) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/test-account.ts", "delete", guestId], { stdio: "ignore" });
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
