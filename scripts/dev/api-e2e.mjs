// End-to-end over HTTP as a stranger: guest click -> POST /api/jobs -> poll -> fetch media.
// usage: node scripts/dev/api-e2e.mjs <baseUrl> [prompt]
// Spends one real generation (2 credits of a fresh guest, ~58 Neurons, 1 upload).
import puppeteer from "puppeteer-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [, , base, promptArg] = process.argv;
const prompt = promptArg ?? `a lone lighthouse on black volcanic rocks under a violet storm sky, film photo ${Date.now()}`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: mkdtempSync(join(tmpdir(), "hf-e2e-")), args: ["--no-first-run", "--disable-extensions"] });
const page = await browser.newPage();
await page.goto(base + "/", { waitUntil: "networkidle0" });
await page.click("form button[type=submit]");
await page.waitForFunction(() => !!document.querySelector('a[href="/credits"]'), { timeout: 30000 });
const out = await page.evaluate(async (prompt) => {
  const log = [];
  const t0 = Date.now();
  const post = (body) => fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const bad = await post({ modelId: "flux_1_schnell", prompt: "x", aspect: "1:1", resolution: "1K", batchSize: 1 });
  log.push(`invalid prompt -> ${bad.status} ${(await bad.json()).error}`);
  const res = await post({ modelId: "flux_1_schnell", prompt, aspect: "9:16", resolution: "1K", batchSize: 1 });
  const body = await res.json();
  log.push(`submit -> ${res.status} status=${body.job?.status} balance=${body.balanceTenths / 10}`);
  let job = body.job;
  while (job && (job.status === "queued" || job.status === "processing") && Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 1500));
    job = (await (await fetch(`/api/jobs?ids=${job.id}`)).json()).jobs[0];
    log.push(`poll ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${job.status} ${job.progress}%`);
  }
  log.push(`final: ${job?.status} ${job?.errorCode ?? ""} assets=${job?.assets.length} ${job?.assets[0]?.width}x${job?.assets[0]?.height} source=${job?.assets[0]?.source}`);
  if (job?.assets[0]) {
    const m = await fetch(job.assets[0].url);
    const buf = new Uint8Array(await m.arrayBuffer());
    log.push(`media -> ${m.status} ${m.headers.get("content-type")} ${buf.length} bytes, cache-control "${m.headers.get("cache-control")}"`);
  }
  const list = await (await fetch("/api/jobs?vertical=image")).json();
  log.push(`list -> ${list.jobs.length} job(s), balance=${list.balanceTenths / 10}`);
  log.push(`outside media prefixes -> ${(await fetch("/media/secrets/x.txt")).status}`);
  return log;
}, prompt);
console.log(out.join("\n"));
await browser.close();
