import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { CreditGlyph } from "@/components/credits/credit-glyph";
import { db } from "@/db";
import { models } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatCredits } from "@/lib/credits/format";
import { listLedger } from "@/lib/credits/ledger";
import { priceJob } from "@/lib/credits/pricing";

export const metadata = { title: "Credits · Higgsfield clone" };

const REASON_LABEL: Record<string, string> = {
  signup_grant: "Welcome credits",
  plan_grant: "Plan credits",
  demo_topup: "Plan credits (demo checkout)",
  generation_charge: "Generation",
  generation_refund: "Refund",
  adjustment: "Adjustment",
};

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/credits");

  const [entries, activeModels] = await Promise.all([
    listLedger(user.id),
    db.select().from(models).where(eq(models.active, true)).orderBy(asc(models.vertical), asc(models.sort)),
  ]);

  // Credits translated into outcomes, never left abstract (recon §3), from real model prices.
  const outcomes = activeModels.map((m) => {
    const params = {
      resolution: m.capabilities.resolutions.at(-1) ?? "",
      batchSize: 1,
      durationS: m.capabilities.durations?.[0],
    };
    const { costTenths } = priceJob(m.pricing, params);
    const count = Math.floor(user.creditBalanceTenths / costTenths);
    const unit = m.vertical === "video" ? `${params.durationS}s ${params.resolution} videos` : "images";
    return { id: m.id, text: `${count.toLocaleString("en-US")} ${m.name} ${unit}`, each: formatCredits(costTenths) };
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <section className="rounded-3xl border border-white/10 bg-[#141416] p-6">
        <p className="text-sm text-white/55">Balance</p>
        <p className="mt-1 flex items-center gap-2 text-4xl font-bold tabular-nums">
          <CreditGlyph className="h-7 w-7 text-accent" />
          {formatCredits(user.creditBalanceTenths)}
        </p>
        <a href="/pricing" className="mt-4 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-black">
          Get more credits
        </a>
        <ul className="mt-4 space-y-1 text-sm text-white/70">
          {outcomes.map((o) => (
            <li key={o.id}>
              = {o.text} <span className="text-white/40">({o.each} each)</span>
            </li>
          ))}
        </ul>
      </section>

      {user.kind === "guest" && (
        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/85">You&apos;re in a guest session. Create an account to keep your images, videos and credits.</p>
          <a href="/signup?next=/credits" className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-black">
            Sign up
          </a>
        </section>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-widest text-white/50">History</h2>
      <ol className="divide-y divide-white/5 rounded-2xl border border-white/10">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">{REASON_LABEL[e.reason] ?? e.reason}</p>
              <p className="truncate text-xs text-white/40">
                {e.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC{e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <p className={`text-sm font-semibold ${e.deltaTenths < 0 ? "text-white" : "text-accent"}`}>
                {e.deltaTenths > 0 ? "+" : "−"}
                {formatCredits(Math.abs(e.deltaTenths))}
              </p>
              <p className="text-xs text-white/40">{formatCredits(e.balanceAfterTenths)} after</p>
            </div>
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-6 text-center text-sm text-white/50">No activity yet.</li>}
      </ol>
    </main>
  );
}
