// The log and its permalinks through the real UI, and the privacy rules around them:
// a guest's log (media and list views, filters, the ledger reconciling with the balance), a
// private permalink that a stranger gets a 404 for, a registered owner publishing a run and a
// stranger then seeing it (without the owner's balance), and deleting the output taking it
// back off the public log. Runs are test fixtures (scripts/dev/fixture-run.ts): the image
// provider's free daily allocation is shared with production, so this test never spends it.
// Both test accounts are deleted afterwards, fixtures included.
// usage: node scripts/dev/ui-log-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const shot = async (page, name) => shotDir && page.screenshot({ path: `${shotDir}/${name}-${tag}.png` });
const text = (page, sel = "main") => page.$eval(sel, (m) => m.innerText).catch(() => "");
const clickExact = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === x); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
const tsx = (...args) => JSON.parse(execFileSync("npx", ["tsx", "--conditions", "react-server", ...args], { encoding: "utf8" }).trim().split("\n").pop());

const sessionUser = async (page) => JSON.parse(Buffer.from((await page.cookies()).find((c) => c.name === "hf_session").value.split(".")[1], "base64url").toString()).sub;
const fixtureRun = (userId, prompt) => tsx("scripts/dev/fixture-run.ts", userId, prompt);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-log-")), args: ["--no-first-run"] });
let testUser = null;
let guestId = null;
try {
  const vp = { width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile };
  const page = await browser.newPage();
  await page.setViewport(vp);

  // A. Guest.
  await page.goto(`${base}/log`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("[data-entry]");
  const invite = await text(page);
  check("signed out: /log is an invitation, with the public log beneath", invite.includes("Your log starts with your first run") && invite.includes("100 free credits") && invite.includes("From the public log"));
  await shot(page, "0-log-signed-out");
  await page.evaluate(() => fetch("/api/auth/guest", { method: "POST" }));
  guestId = await sessionUser(page);
  const g = fixtureRun(guestId, "a folded paper crane on a stack of old maps, window light");

  await page.goto(`${base}/log`, { waitUntil: "load" });
  await page.waitForSelector("[data-entry] img");
  const media = await text(page);
  check("media view by default: the image leads, receipt beneath, private with a way to publish", media.includes("−2") && media.includes("Private") && media.includes("Create an account to publish") && !!(await page.$(`[data-entry="${g.id}"] img`)));
  check("no horizontal overflow (media)", (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) === 0);
  await shot(page, "1-log-media");

  await clickExact(page, "label span", "List");
  await page.waitForFunction(() => location.search.includes("view=list"));
  await new Promise((r) => setTimeout(r, 400)); // let the choice's colour transition settle before the screenshot
  const list = await text(page);
  check("list view: each movement with the balance after it, grants included", /−2\s*charged/.test(list) && list.includes("98 after") && list.includes("Welcome credits") && list.includes("+100") && list.includes("100 after"), list.replace(/\s+/g, " ").slice(0, 160));
  await shot(page, "2-log-list");
  await clickExact(page, "label span", "Camera moves");
  const empty = await text(page);
  check("filtered to camera moves: an invitation, not a blank", empty.includes("No camera moves yet") && empty.includes("Move the camera"));
  await clickExact(page, "label span", "Everything");
  await clickExact(page, "label span", "Media");

  await page.goto(`${base}/log/${g.id}`, { waitUntil: "load" });
  await page.waitForSelector("main img");
  const own = await text(page);
  check("permalink, owner: the full record, including balance after", own.includes("FLUX.1 [schnell]") && own.includes("Balance after") && own.includes("98 credits"), own.replace(/\s+/g, " ").slice(0, 260));
  await shot(page, "3-record-owner");

  const stranger = await browser.createBrowserContext();
  const sp = await stranger.newPage();
  await sp.setViewport(vp);
  const r1 = await sp.goto(`${base}/log/${g.id}`, { waitUntil: "load" });
  check("a stranger gets a 404 for a private run, with no hint it exists", r1.status() === 404 && (await text(sp)).includes("isn't public, or it doesn't exist"), String(r1.status()));
  await shot(sp, "4-not-public");

  // B. A registered owner publishes, a stranger sees it, deleting takes it back down.
  testUser = tsx("scripts/dev/test-account.ts", "create");
  const owner = await browser.createBrowserContext();
  const op = await owner.newPage();
  await op.setViewport(vp);
  await op.goto(`${base}/make`, { waitUntil: "load" });
  await op.setCookie({ name: "hf_session", value: testUser.token, url: base });
  const r = fixtureRun(testUser.userId, "a brass telescope on a rooftop at dawn, city haze");
  await op.goto(`${base}/log`, { waitUntil: "load" });
  await op.waitForSelector(`[data-entry="${r.id}"] img`);
  await op.evaluate((id) => [...document.querySelectorAll(`[data-entry="${id}"] button`)].find((b) => b.textContent.trim() === "Publish").click(), r.id);
  await op.waitForFunction((id) => document.querySelector(`[data-entry="${id}"]`).innerText.includes("Make private"), {}, r.id);
  check("publish: the tag says Public and the control offers Make private", (await op.$eval(`[data-entry="${r.id}"]`, (e) => e.innerText)).includes("Public"));
  await shot(op, "5-published");

  const r2 = await sp.goto(`${base}/log/${r.id}`, { waitUntil: "load" });
  await sp.waitForSelector("main img");
  const pub = await text(sp);
  check("a stranger can open the published run, without the owner's balance", r2.status() === 200 && pub.includes("Public") && !pub.includes("Balance after") && pub.includes("Copy link"));
  const feed = await sp.evaluate(async () => (await (await fetch("/api/log?scope=public&limit=50")).json()).entries.map((e) => e.id));
  check("it appears in the public log", feed.includes(r.id));
  const og = await sp.$eval('meta[property="og:image"]', (m) => m.content).catch(() => "");
  check("share preview points at the image", og.includes("/media/"), og);
  await shot(sp, "6-record-public");

  await op.goto(`${base}/log/${r.id}`, { waitUntil: "networkidle0" });
  // Click until the confirm step shows: the first click can land before hydration.
  for (let i = 0; i < 10 && !(await text(op)).includes("Delete it"); i++) {
    await clickExact(op, "main button", "Delete the output");
    await new Promise((res) => setTimeout(res, 300));
  }
  await clickExact(op, "main button", "Delete it");
  await op.waitForFunction(() => document.querySelector("main").innerText.includes("The output was deleted"));
  const r3 = await sp.goto(`${base}/log/${r.id}`, { waitUntil: "load" });
  const feed2 = await sp.evaluate(async () => (await (await fetch("/api/log?scope=public&limit=50")).json()).entries.map((e) => e.id));
  check("deleting the output takes it off the public log; the owner keeps the record", r3.status() === 404 && !feed2.includes(r.id) && (await text(op)).includes("with what it cost"));
  await shot(op, "7-deleted");
} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  if (testUser) tsx("scripts/dev/test-account.ts", "delete", testUser.userId);
  if (guestId) tsx("scripts/dev/test-account.ts", "delete", guestId);
  await browser.close();
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
