// The create flow through the real UI, as a stranger: /make signed out shows the invitation
// and the public log; "Make the image" starts a guest session, drains the meter, prints a
// pending entry and lands a real FLUX image with its receipt; "Move the camera over this"
// hands the still to the camera-move mode; a pre-rendered move (arc) comes back free and
// labelled, compared against the library still it was really rendered over; a large batch is
// cancelled and refunded; and an empty balance turns the button into "Get more credits".
// Run the server with IMAGE_PROVIDER=fixture: images then come from the test fixture and the
// shared daily allowance is never spent (the page says "Test mode"; the test refuses otherwise).
// Live renders only with E2E_LIVE=1, and never point that at Vercel (compute allowance).
// usage: IMAGE_PROVIDER=fixture next start -p 3100; node scripts/dev/ui-make-e2e.mjs <baseUrl> [screenshotDir] [--mobile]
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
const clickText = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().startsWith(x)); if (!el) throw new Error(`no ${s} "${x}"`); el.scrollIntoView({ block: "center" }); el.click(); }, sel, t);
const clickExact = (page, sel, t) => page.evaluate((s, x) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim() === x); if (!el) throw new Error(`no ${s} "${x}"`); el.click(); }, sel, t);
// The balance chip (the nav's "Credits" link shares its href).
const balance = (page) => page.evaluate(() => [...document.querySelectorAll("header a")].map((a) => a.textContent.trim()).find((t) => /^[\d.,]+ credits/.test(t))?.replace(/ credits.*/, "") ?? "none");
const firstEntry = (page) => page.$eval("[data-entry]", (e) => e.innerText).catch(() => "");
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

let guestId = null;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-mk-")), args: ["--no-first-run", "--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });

  // 1. A stranger lands on /make.
  await page.goto(`${base}/make`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("#prompt");
  const body = await page.evaluate(() => document.body.innerText);
  check("signed out: make box, the invitation line and the public log", body.includes("Everything you make lands here") && body.includes("From the public log") && (await page.$$("[data-entry]")).length >= 3);
  check("library entries are tagged as library, with no amount", !(await firstEntry(page)).includes("free") && (await firstEntry(page)).includes("From the library"));
  const allowanceLine = await page.$eval("[data-quota]", (e) => e.innerText);
  if (!allowanceLine.startsWith("Test mode")) throw new Error("server isn't in fixture mode: refusing to spend the real image allowance");
  check("the allowance line shows your real remaining count (5 today)", allowanceLine.includes("You can make 5 more today"), allowanceLine);
  const meter = await page.$eval('[role="img"][aria-label^="This costs"]', (m) => m.getAttribute("aria-label"));
  check("price drawn against the starter balance before anything is pressed", /costs 2 of your 100 credits, leaving 98/.test(meter), meter);
  check("no horizontal overflow (empty)", (await overflow(page)) === 0);
  await shot(page, "1-empty");

  // 2. Make an image: guest session, the commit, a pending entry, then a real image.
  const prompt = `a paper lantern floating over a flooded rice field at blue hour ${Date.now()}`;
  await page.type("#prompt", prompt);
  await clickText(page, "form button[type=submit]", "Make the image");
  await page.waitForSelector('[data-state="committing"]', { timeout: 30000 });
  check("the commit: the meter drains", true);
  await page.waitForSelector(".entry-new", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 900));
  const pending = await firstEntry(page);
  check("a new entry prints into the top of the log, pending, with progress", /Making the image/.test(pending) && !!(await page.$('[data-entry] [role="progressbar"]')), pending.split("\n")[0]);
  await shot(page, "2-pending");
  await page.waitForFunction((p) => [...document.querySelectorAll("[data-entry] img")].some((i) => i.alt === p && i.complete && i.naturalWidth > 0), { timeout: 90000 }, prompt);
  await page.waitForFunction(() => [...document.querySelectorAll("header a")].some((a) => a.textContent.startsWith("98 credits")), { timeout: 15000 }).catch(() => {});
  const done = await firstEntry(page);
  check("a real image lands, with its receipt: model and −2 charged", done.includes("FLUX.1 [schnell]") && done.includes("−2") && done.includes("charged"), done.replace(/\s+/g, " ").slice(0, 120));
  check("header balance 100 -> 98", (await balance(page)) === "98", await balance(page));
  check("no horizontal overflow (log)", (await overflow(page)) === 0);
  await shot(page, "3-image");

  // 3. The loop: move the camera over that image.
  await clickText(page, "[data-entry] button", "Move the camera over this");
  await page.waitForFunction(() => document.body.innerText.includes("Image to animate"));
  const handed = await page.$eval("form", (f) => f.innerText);
  check("'Move the camera over this' hands the still to camera-move mode", handed.includes(prompt.slice(0, 30)) && handed.includes("Camera move"));

  await clickText(page, "form button", "General");
  await page.waitForSelector("dialog[open]");
  await page.waitForFunction(() => document.querySelectorAll("dialog[open] ul li").length >= 14);
  const tags = await page.$$eval("dialog[open] li", (li) => li.filter((l) => l.innerText.includes("Pre-rendered only")).length);
  check("move picker: 14 moves with real previews; arcs and rack focus marked pre-rendered only", tags === 4, `${tags} marked`);
  await shot(page, "4-moves");
  await clickText(page, "dialog[open] li button", "Arc Pan Left");
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const btn = await page.$eval("form button[type=submit]", (b) => b.innerText);
  const costText = await page.$eval("form", (f) => f.innerText);
  check("a pre-rendered-only move says so before the press, and costs nothing", btn === "Get the example" && costText.includes("Costs nothing") && /pre-rendered example, free/.test(costText), btn);
  await clickText(page, "form button[type=submit]", "Get the example");
  await page.waitForFunction(() => document.querySelector("[data-entry]")?.innerText.includes("pre-rendered example"), { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900)); // let the entry finish printing in
  const ex = await firstEntry(page);
  check("the example is labelled, free, and says it's over a library still", ex.includes("Pre-rendered example") && /0\s*free/.test(ex) && ex.includes("over a library still") && ex.includes("Nothing was charged"), ex.replace(/\s+/g, " ").slice(0, 160));
  const cmp = await page.$eval("[data-entry]", (e) => ({ slider: !!e.querySelector('[role="slider"]'), labels: e.innerText.includes("Library still") }));
  check("compare handle over the still it was really rendered over (library, not yours)", cmp.slider && cmp.labels);
  await page.focus('[data-entry] [role="slider"]');
  await page.keyboard.press("ArrowLeft");
  check("compare handle moves with the keyboard", (await page.$eval('[data-entry] [role="slider"]', (s) => s.getAttribute("aria-valuenow"))) === "45");
  check("balance unchanged by the example (98)", (await balance(page)) === "98", await balance(page));
  await page.$eval("[data-entry]", (e) => e.scrollIntoView({ block: "start" }));
  await page.evaluate(() => scrollBy(0, -80));
  const examplePlays = await page.waitForFunction(() => { const v = document.querySelector("[data-entry] video"); return v && v.readyState >= 2 && v.videoWidth > 0 && !v.classList.contains("skeleton"); }, { timeout: 30000 }).then(() => true, () => false);
  check("the example take decodes and plays", examplePlays);
  await shot(page, "5-example");

  // 4. Optional live render (local only).
  if (process.env.E2E_LIVE === "1") {
    await clickText(page, "form button", "Arc Pan Left");
    await page.waitForSelector("dialog[open]");
    await clickText(page, "dialog[open] li button", "Slow Push In");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await clickText(page, "form button[type=submit]", "Render the move");
    await page.waitForFunction(() => document.querySelector("[data-entry]")?.innerText.includes("Slow Push In") && !document.querySelector("[data-entry]").getAttribute("aria-busy"), { timeout: 120000 });
    const live = await firstEntry(page);
    check("live render: compared against your own still, −30 charged", live.includes("−30") && live.includes("rendered with ffmpeg") && (await page.$eval("[data-entry]", (e) => e.innerText.includes("Still"))), live.replace(/\s+/g, " ").slice(0, 120));
    await page.$eval("[data-entry]", (e) => e.scrollIntoView({ block: "start" }));
    await page.evaluate(() => scrollBy(0, -80));
    const plays = await page.waitForFunction(() => { const v = document.querySelector("[data-entry] video"); return v && v.readyState >= 2 && v.videoWidth > 0 && !v.classList.contains("skeleton"); }, { timeout: 30000 }).then(() => true, () => false);
    check("the fresh take actually decodes and plays in the compare view", plays);
    await shot(page, "6-live");
  }

  // 5. Not enough credits: the button becomes a way to get more, and nothing is charged.
  const token = (await page.cookies()).find((c) => c.name === "hf_session")?.value;
  const userId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
  guestId = userId;
  execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/set-balance.ts", userId, "10"], { stdio: "ignore" });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#prompt");
  await clickExact(page, "form label span", "Image");
  await clickExact(page, "form label span", "4");
  const short = await page.$eval("form", (f) => f.innerText);
  check("short on credits: says what it costs and what you have, offers 'Get more credits'", short.includes("This costs 8 credits and you have 1") && short.includes("Get more credits") && !(await page.$("form button[type=submit]")));
  await shot(page, "8-short");
  execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/set-balance.ts", userId, "980"], { stdio: "ignore" });
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#prompt");

  // 6. Cancel a run: four images take long enough to stop, and the refund is on the record.
  await page.$eval("#prompt", (t) => {
    // Clear a React-controlled textarea the way a user's edit would.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(t, "");
    t.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.type("#prompt", `four studies of a copper kettle on a windowsill ${Date.now()}`);
  await clickExact(page, "form label span", "4");
  await clickText(page, "form button[type=submit]", "Make the images");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-entry][aria-busy="true"]')].some((e) => e.innerText.includes("copper kettle")), { timeout: 20000 });
  const running = await firstEntry(page);
  check("a batch says 'Making the images' while it runs", running.startsWith("Making the images"), running.split("\n")[0]);
  await clickText(page, "[data-entry] button", "Cancel");
  await page.waitForFunction(() => document.querySelector("[data-entry]")?.innerText.includes("You stopped this run"), { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  const stopped = await firstEntry(page);
  check("cancel: the run says it stopped, and shows +8 refunded", stopped.includes("+8") && stopped.includes("refunded") && stopped.includes("copper kettle") && !stopped.includes("paper lantern"), stopped.replace(/\s+/g, " ").slice(0, 120));
  await shot(page, "7-canceled");

  // 7. The per-visitor cap: 1 + 4 images today, so no more, and the page says when that resets.
  await page.waitForFunction(() => document.querySelector("[data-quota]")?.innerText.includes("made your 5 free images"), { timeout: 15000 }).catch(() => {});
  const capped = await page.$eval("form", (f) => f.innerText);
  const disabled = await page.$eval("form button[type=submit]", (b) => b.disabled).catch(() => null);
  check("when capped, no price is drawn for images you can't make", !(await page.$('form [role="img"][aria-label^="This costs"]')));
  check("a retry that today's allowance can't run isn't offered", !(await firstEntry(page)).includes("Try again"));
  check("after 5 images: 'You've made your 5 free images today', and Make is disabled", capped.includes("made your 5 free images today") && /00:00 UTC/.test(capped) && disabled === true && !capped.includes("Get more credits"), `${disabled} | ${await page.$eval("[data-quota]", (e) => e.innerText)}`);
  await page.$eval("form", (f) => f.scrollIntoView({ block: "start" }));
  await page.evaluate(() => scrollBy(0, -80));
  await shot(page, "9-capped");


} catch (e) {
  console.log(results.join("\n"));
  throw e;
} finally {
  await browser.close();
  // The guest and its fixture runs are test data: remove them.
  if (guestId) execFileSync("npx", ["tsx", "--conditions", "react-server", "scripts/dev/test-account.ts", "delete", guestId], { stdio: "ignore" });
}
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
