import Link from "next/link";
import { GuestButton } from "@/components/auth/guest-button";
import { CreditGlyph } from "@/components/credits/credit-glyph";
import type { CurrentUser } from "@/lib/auth/current-user";
import { formatCredits } from "@/lib/credits/format";
import { AutoVideo } from "./auto-video";
import { type ExploreTile, MediaSection } from "./section";
import { SkeletonImg } from "@/components/media/skeleton-media";

export type ExploreData = {
  user: CurrentUser | null;
  imageCost: number; // tenths
  videoCost: number; // tenths
  presets: (ExploreTile & { name: string; presetId: string; description: string })[];
  sections: Record<"cinema" | "portrait" | "street" | "product" | "fantasy" | "nature" | "poster", ExploreTile[]>;
};

// Explore = landing (recon 19/22): one page, five auth-conditional slots (top strip, header
// cluster, promo card, preset quick-link badge, hero CTA wording). Every CTA lands on a real
// route; nothing here links to a product this build doesn't have.
export function ExplorePage({ user, imageCost, videoCost, presets, sections }: ExploreData) {
  const byId = (id: string) => presets.find((p) => p.presetId === id);
  const hero = [
    { title: "Camera presets", text: `${presets.length} real camera moves, rendered over any image.`, href: "/ai/video?gallery=1", media: byId("crash-zoom") },
    { title: "Create image", text: "FLUX.1 [schnell], in a couple of seconds.", href: "/ai/image", media: sections.portrait[0] },
    { title: "Animate any image", text: "Push in, pan, arc or pull focus.", href: "/ai/video?preset=rack-focus-in", media: byId("rack-focus-in") },
    { title: "Your assets", text: "Every image and render in one library.", href: "/assets", media: sections.fantasy[1] },
  ];
  const credits = user ? Math.floor(user.creditBalanceTenths / imageCost) : Math.floor(1000 / imageCost);

  return (
    <main className="flex flex-col gap-10 pb-0 sm:gap-14">
      {/* Auth slot 1: top strip */}
      <div className="bg-accent text-black">
        <div className="mx-auto flex max-w-[1440px] items-center justify-center gap-3 px-3 py-2 text-center text-xs font-medium sm:text-sm">
          {user ? (
            user.kind === "guest" ? (
              <>
                <span>Guest session · {formatCredits(user.creditBalanceTenths)} credits left.</span>
                <Link href="/signup" className="rounded-md bg-black px-2.5 py-1 text-xs font-semibold text-accent">
                  Keep your work
                </Link>
              </>
            ) : (
              <>
                <span>{formatCredits(user.creditBalanceTenths)} credits ready to spend.</span>
                <Link href="/ai/video" className="rounded-md bg-black px-2.5 py-1 text-xs font-semibold text-accent">
                  Direct a shot
                </Link>
              </>
            )
          ) : (
            <>
              <span>100 free credits. No email, no card.</span>
              <Link href="/ai/image" className="rounded-md bg-black px-2.5 py-1 text-xs font-semibold text-accent">
                Start creating
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Hero row: four feature cards */}
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {hero.map((h) => (
            <Link key={h.title} href={h.href} className="group w-[78%] shrink-0 snap-start sm:w-auto">
              <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-white/5">
                {h.media?.kind === "video" ? (
                  <AutoVideo src={h.media.url} poster={h.media.posterUrl} className="h-full w-full object-cover" />
                ) : (
                  h.media && <SkeletonImg src={h.media.url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                )}
              </div>
              <p className="mt-2 text-sm font-black uppercase tracking-tight">{h.title}</p>
              <p className="text-xs text-white/50">{h.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Auth slot 2: promo card, beside six quick links (slot 3: the presets badge) */}
      <section className="mx-auto grid w-full max-w-[1440px] gap-3 px-3 sm:px-4 lg:grid-cols-[1.1fr_2fr]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-6">
          {sections.fantasy[5] && (
            <SkeletonImg src={sections.fantasy[5].url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
          <div className="relative flex h-full flex-col gap-3">
            {user ? (
              <>
                <p className="text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
                  {formatCredits(user.creditBalanceTenths)} credits
                  <br />
                  <span className="text-accent">in your pocket</span>
                </p>
                <p className="text-sm text-white/70">
                  = {credits} images or {Math.floor(user.creditBalanceTenths / videoCost)} videos
                </p>
                <Link href="/credits" className="mt-auto flex h-11 w-fit items-center rounded-xl bg-accent px-5 font-semibold text-black">
                  See your credits
                </Link>
              </>
            ) : (
              <>
                <p className="text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
                  Try it free
                  <br />
                  <span className="text-accent">in one click</span>
                </p>
                <p className="text-sm text-white/70">
                  100 credits = {credits} images or {Math.floor(1000 / videoCost)} videos. Sign up later to keep your work.
                </p>
                <div className="mt-auto w-full max-w-xs">
                  <GuestButton next="/ai/image" />
                </div>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { title: "FLUX.1 [schnell]", text: "Text to image", href: "/ai/image", badge: "TOP", icon: "▣" },
            { title: "Camera Motion", text: "Image to video", href: "/ai/video", badge: user ? "FREE PREVIEWS" : "NEW", icon: "▶" },
            { title: "Preset gallery", text: `${presets.length} camera moves`, href: "/ai/video?gallery=1", badge: null, icon: "✦" },
            { title: "Assets", text: "Your library", href: "/assets", badge: null, icon: "▤" },
            { title: "Credits", text: "Balance and history", href: user ? "/credits" : "/ai/image", badge: null, icon: "◈" },
            { title: user?.kind === "registered" ? "Your account" : "Sign up", text: user?.kind === "registered" ? "Signed in" : "Keep your work", href: user?.kind === "registered" ? "/credits" : "/signup", badge: null, icon: "◉" },
          ].map((q) => (
            <Link key={q.title} href={q.href} className="flex min-h-24 flex-col justify-between rounded-2xl border border-white/10 bg-[#121214] p-3 hover:bg-white/[0.06] sm:p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="text-lg text-white/70">{q.icon}</span>
                {q.badge && <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold text-black">{q.badge}</span>}
              </span>
              <span>
                <span className="block text-sm font-semibold">{q.title}</span>
                <span className="block text-xs text-white/45">{q.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Banner: the product's actual promise, with a real CTA */}
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(80%_120%_at_50%_0%,#262a18_0%,#0b0b0c_70%)] px-5 py-10 text-center sm:py-14">
          <p className="text-sm text-white/55">Rendered, not hallucinated</p>
          <p className="mt-1 text-3xl font-black uppercase tracking-tight sm:text-6xl">
            Real camera <span className="text-accent">moves</span>
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/55">Push-ins, pans, arcs, handheld drift and focus pulls, rendered frame by frame over your image into a real MP4.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/ai/video" className="flex h-11 items-center rounded-xl bg-accent px-5 font-semibold text-black">
              Animate an image
            </Link>
            <Link href="/ai/video?gallery=1" className="flex h-11 items-center rounded-xl border border-white/15 px-5 font-semibold">
              See the presets
            </Link>
          </div>
        </div>
      </section>

      <MediaSection
        title="Camera presets"
        subtitle="Every preview is real renderer output: pick one and it's applied to your image."
        tiles={presets}
        action={{ label: "Try for free", href: "/ai/video" }}
        pill={{ label: "View all presets", href: "/ai/video?gallery=1" }}
        columns="columns-2 sm:columns-3 lg:columns-4"
      />

      <MediaSection title="Cinematic stills" subtitle="Film-grade frames from FLUX.1 [schnell]. Tap one to start from its prompt." tiles={sections.cinema} pill={{ label: "Create a still", href: "/ai/image" }} columns="columns-2 lg:columns-4" />

      {/* Community grid shape (recon 19): key-art cards, each opens its prompt in the studio */}
      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <h2 className="text-lg font-black uppercase tracking-tight text-accent sm:text-2xl">Inside every project</h2>
        <p className="mb-3 mt-0.5 text-xs text-white/50 sm:text-sm">Key art made in this app, with the exact prompt behind each one.</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {sections.poster.map((t, i) => (
            <Link key={t.id} href={t.href} className="group overflow-hidden rounded-xl border border-white/10 bg-[#121214]">
              <div className="aspect-video overflow-hidden">
                <SkeletonImg src={t.url} alt={t.prompt ?? ""} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="flex items-center justify-between gap-2 p-2.5">
                <span className="min-w-0 truncate text-xs text-white/80">{POSTER_TITLES[i] ?? "Untitled"} · by Higgsfield clone</span>
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">Public</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <MediaSection title="Portraits" subtitle="Editorial, street and studio portraits." tiles={sections.portrait} pill={{ label: "Create a portrait", href: "/ai/image" }} />

      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <div className="grid items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f3b3a] to-[#0b1f4a] p-6 sm:grid-cols-2 sm:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">One library</p>
            <p className="mt-2 text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
              Make it once.
              <br />
              Animate it next.
            </p>
            <p className="mt-3 max-w-md text-sm text-white/65">Every image you generate lands in Assets, one tap away from becoming a video.</p>
            <Link href="/assets" className="mt-5 inline-flex h-11 items-center rounded-xl bg-white px-5 font-semibold text-black">
              Open Assets
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sections.street.slice(0, 3).map((t) => (
              <SkeletonImg key={t.id} src={t.url} alt="" loading="lazy" className="aspect-[9/16] w-full rounded-xl object-cover" />
            ))}
          </div>
        </div>
      </section>

      <MediaSection title="Street" subtitle="Vertical frames for stories and reels." tiles={sections.street} pill={{ label: "Create a vertical", href: "/ai/image" }} columns="columns-3 lg:columns-5" />
      <MediaSection title="Product shots" subtitle="Clean, bright product photography." tiles={sections.product} pill={{ label: "Create a product shot", href: "/ai/image" }} columns="columns-2 sm:columns-3 lg:columns-5" />

      <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <div className="flex gap-2 p-2 opacity-60">
            {sections.fantasy.slice(2, 7).map((t) => (
              <SkeletonImg key={t.id} src={t.url} alt="" loading="lazy" className="h-40 w-1/3 shrink-0 rounded-2xl object-cover sm:h-56 sm:w-1/5" />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-start justify-center bg-gradient-to-r from-black/90 via-black/60 to-transparent p-6 sm:p-10">
            <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-black">TRANSPARENT CREDITS</span>
            <p className="mt-3 text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
              See every charge.
              <br />
              <span className="text-accent">Get every refund.</span>
            </p>
            <p className="mt-3 max-w-md text-sm text-white/65">The price is on the button before you press it. Failed generations refund automatically.</p>
          </div>
        </div>
      </section>

      <MediaSection title="Worlds" subtitle="Surreal, fantasy and sci-fi scenes." tiles={sections.fantasy} pill={{ label: "Create a world", href: "/ai/image" }} columns="columns-2 lg:columns-4" />
      <MediaSection title="Nature" subtitle="Landscapes, wildlife and macro." tiles={sections.nature} pill={{ label: "Create a landscape", href: "/ai/image" }} columns="columns-2 sm:columns-3" />

      {/* Tag cloud (recon 19), every tag a real destination */}
      <section className="mx-auto w-full max-w-4xl px-3 text-center sm:px-4">
        <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Explore more</h2>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {[
            ...presets.map((p) => ({ label: p.name, href: `/ai/video?preset=${p.presetId}` })),
            { label: "FLUX.1 [schnell]", href: "/ai/image" },
            { label: "Camera Motion", href: "/ai/video" },
            { label: "Assets", href: "/assets" },
            { label: "Credits", href: user ? "/credits" : "/signup" },
          ].map((tag) => (
            <Link key={tag.label} href={tag.href} className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white">
              {tag.label}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-4 bg-accent text-black">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <p className="text-2xl font-black uppercase leading-none tracking-tight">
              AI-native
              <br />
              creative suite
            </p>
            <p className="mt-3 max-w-xs text-xs text-black/60">
              An independent rebuild made for a hiring assignment. Not affiliated with, or endorsed by, Higgsfield Inc.
            </p>
          </div>
          <FooterCol title="Create" links={[["Create image", "/ai/image"], ["Create video", "/ai/video"], ["Camera presets", "/ai/video?gallery=1"]]} />
          <FooterCol title="Library" links={[["Assets", "/assets"], ["Credits", user ? "/credits" : "/signup"]]} />
          <FooterCol title="Account" links={user?.kind === "registered" ? [["Credits", "/credits"]] : [["Sign up", "/signup"], ["Log in", "/login"]]} />
        </div>
        <div className="bg-black px-4 py-3 text-center text-xs text-white/50">
          <CreditGlyph className="mr-1 inline h-3 w-3 text-accent" />
          Images: FLUX.1 [schnell] via Cloudflare Workers AI · Videos: camera moves rendered with ffmpeg
        </div>
      </footer>
    </main>
  );
}

const POSTER_TITLES = ["Dust Rider", "Stormbound", "Hill of Giants", "Red Door", "Wolf Winter", "Neon Rain", "The Keeper", "Jungle Fall"];

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs text-black/50">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
