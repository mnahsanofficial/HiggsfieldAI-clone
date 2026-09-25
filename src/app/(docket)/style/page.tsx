import { and, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { SkeletonBlock } from "@/components/media/skeleton-media";
import { Amount, Price } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Compare } from "@/components/ui/compare";
import { CostMeter } from "@/components/ui/cost-meter";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { db } from "@/db";
import { assets, presets } from "@/db/schema";
import { MeterDemo, SegmentedDemo, SheetDemo } from "./demos";

export const metadata = { title: "Design system", robots: { index: false } };

// Docket's components in every state, in isolation, against real data. Not linked from the
// product; scripts/dev/design-system-check.mjs audits this page.

const COLOURS = [
  { name: "Paper", hex: "#fcfcfa", role: "The page", text: false },
  { name: "Field", hex: "#efefeb", role: "Entry blocks and inputs", text: false },
  { name: "Line", hex: "#d9dad4", role: "Block edges", text: false },
  { name: "Ink", hex: "#14161a", role: "Text and primary actions", text: true },
  { name: "Muted", hex: "#595e66", role: "Secondary text", text: true },
  { name: "Posted", hex: "#0f6b4f", role: "Credits in: refunded, added, free", text: true },
  { name: "Charged", hex: "#b3341f", role: "Credits out, failures", text: true },
  { name: "Live", hex: "#2457e6", role: "Focus, the run in progress", text: true },
];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <div>
        <h2 className="t-title">{title}</h2>
        {note && <p className="t-meta mt-1 max-w-2xl">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function StylePage() {
  const [pair] = await db
    .select({ take: assets.url, poster: assets.posterUrl, width: assets.width, height: assets.height, sourceId: assets.sourceAssetId, name: presets.name })
    .from(presets)
    .innerJoin(assets, eq(assets.id, presets.previewAssetId))
    .where(and(eq(presets.id, "slow-push-in")))
    .limit(1);
  const [still] = pair?.sourceId ? await db.select({ url: assets.url, prompt: assets.prompt }).from(assets).where(eq(assets.id, pair.sourceId)) : [];

  const amounts = [20, 300, 25, 6000, 5, 18000, 450, 20];

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="t-display">Docket design system</h1>
        <p className="t-body max-w-2xl text-muted">One typeface, eight colours named for what they mean in a record, and a small set of components. Every state below is live, rendered with the same code the product uses.</p>
      </header>

      <Section title="Colour" note="Contrast ratios are computed from the tokens. Text colours pass 4.5:1 on both paper and field.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLOURS.map((c) => (
            <li key={c.name} className="flex flex-col gap-2 rounded-xl bg-field p-3">
              <span className="h-12 rounded-lg border border-line" style={{ background: c.hex }} />
              <span className="t-label">{c.name}</span>
              <span className="t-meta">{c.role}</span>
              {c.text ? (
                <span className="t-meta" data-contrast={c.name}>
                  {c.hex} on paper {contrast(c.hex, "#fcfcfa").toFixed(1)}:1, on field {contrast(c.hex, "#efefeb").toFixed(1)}:1
                </span>
              ) : (
                <span className="t-meta">{c.hex}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type" note="Public Sans throughout. Four sizes and a label; weight, not capitals, carries hierarchy. Tabular figures are on everywhere, so amounts line up without a monospaced face.">
        <div className="flex flex-col gap-3">
          <p className="t-display">Make the image, then move the camera</p>
          <p className="t-title">A push in over a lighthouse at dusk</p>
          <p className="t-body max-w-2xl">Body copy says what happened and what to do next, in plain words and in sentence case. Buttons name the action they take.</p>
          <p className="t-label">Aspect</p>
          <p className="t-meta">FLUX.1 [schnell], 1024 by 1024, 3.1 seconds</p>
        </div>
        <div className="max-w-sm">
          <div className="rounded-xl bg-field p-4">
            <p className="t-label mb-2">A column of amounts, right-aligned</p>
            <ol className="flex flex-col items-end gap-1" data-figures="tabular">
              {amounts.map((t, i) => (
                <li key={i}>
                  <Amount tenths={t} as={i % 3 === 1 ? "refunded" : i === 3 || i === 5 ? "added" : "charged"} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section title="Buttons" note="The label is the action, and it doesn't change while the action runs.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Make the image</Button>
          <Button variant="secondary">Choose a move</Button>
          <Button variant="quiet">Cancel</Button>
          <Button variant="danger">Delete</Button>
          <Button pending>Make the image</Button>
          <Button disabled>Make the image</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Fields" note="16px text on phones, so iOS never zooms in on focus. Errors say what went wrong and what to do.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="demo-prompt" label="Describe the image" hint="Up to 2,000 characters.">
            <TextArea id="demo-prompt" placeholder="A lighthouse on black rocks at dusk, storm clouds, long exposure" aria-describedby="demo-prompt-hint" />
          </Field>
          <div className="flex flex-col gap-4">
            <Field id="demo-email" label="Email">
              <TextInput id="demo-email" type="email" placeholder="you@example.com" />
            </Field>
            <Field id="demo-code" label="Promo code" error="That promo code isn't valid. Check it and try again.">
              <TextInput id="demo-code" defaultValue="HIGGS50" invalid aria-describedby="demo-code-error" />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Choices">
        <SegmentedDemo />
      </Section>

      <Section title="Amounts" note="Credits in and out never depend on colour: every amount has a sign and a word, and colour only reinforces them.">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9375rem]">
          <Amount tenths={20} as="charged" />
          <Amount tenths={20} as="refunded" />
          <Amount tenths={6000} as="added" />
          <Amount tenths={0} as="free" />
          <span className="t-meta">Prices before they move:</span>
          <Price tenths={20} />
          <Price tenths={0} />
        </div>
      </Section>

      <Section title="Cost meter" note="The bar is your balance; the hatched end is what this run takes. Pressing the button drains it: the one orchestrated animation in the product.">
        <div className="grid gap-6 sm:grid-cols-3">
          <CostMeter costTenths={20} balanceTenths={700} />
          <CostMeter costTenths={300} balanceTenths={120} />
          <CostMeter costTenths={0} balanceTenths={700} note="(a pre-rendered example)" />
        </div>
        <div className="max-w-sm">
          <MeterDemo />
        </div>
      </Section>

      <Section title="Tags">
        <div className="flex flex-wrap gap-2">
          <Tag>Generated by FLUX.1 [schnell]</Tag>
          <Tag>Rendered with ffmpeg</Tag>
          <Tag tone="outline">Pre-rendered example</Tag>
          <Tag tone="outline">Private</Tag>
          <Tag tone="ink">Public</Tag>
          <Tag tone="live">Rendering</Tag>
        </div>
      </Section>

      <Section title="Skeletons" note="Shaped like what they stand in for: the media at its real aspect, then the line beneath it.">
        <div className="grid max-w-2xl grid-cols-3 items-start gap-3" data-skeletons>
          {["1 / 1", "16 / 9", "9 / 16"].map((r) => (
            <div key={r} className="flex flex-col gap-2">
              <SkeletonBlock className="w-full rounded-xl" style={{ aspectRatio: r }} />
              <SkeletonBlock className="h-3 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Compare" note="The still, and the camera move rendered over it. Drag the handle, or focus it and use the arrow keys. It never moves on its own.">
        {pair && still ? (
          <div className="max-w-2xl">
            <Compare still={{ url: still.url, alt: still.prompt ?? "The still" }} take={{ url: pair.take, posterUrl: pair.poster, label: `${pair.name}, rendered over the still` }} width={pair.width} height={pair.height} />
            <p className="t-meta mt-2">{pair.name}, the preset preview, over its own library still. Real renderer output, from the database.</p>
          </div>
        ) : (
          <p className="t-meta">No preview pair in this database yet.</p>
        )}
      </Section>

      <Section title="Sheet">
        <SheetDemo />
      </Section>
    </main>
  );
}
