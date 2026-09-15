import Link from "next/link";
import { AutoVideo } from "./auto-video";

export type ExploreTile = {
  id: string;
  kind: "image" | "video";
  url: string;
  posterUrl?: string | null;
  width: number;
  height: number;
  prompt: string | null;
  href: string; // always a real route
  label?: string;
};

// The landing page's repeating unit (recon 19): section title, one-line subtitle, a media grid,
// and a pill that goes somewhere real. Reused for every media section with different data.
export function MediaSection({
  title,
  subtitle,
  tiles,
  pill,
  action,
  columns = "columns-2 sm:columns-3 lg:columns-5",
}: {
  title: string;
  subtitle: string;
  tiles: ExploreTile[];
  pill: { label: string; href: string };
  action?: { label: string; href: string };
  columns?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-3 sm:px-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black uppercase tracking-tight text-accent sm:text-2xl">{title}</h2>
          <p className="mt-0.5 text-xs text-white/50 sm:text-sm">{subtitle}</p>
        </div>
        {action && (
          <Link href={action.href} className="flex h-9 shrink-0 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-black">
            {action.label}
          </Link>
        )}
      </div>
      <div className="relative">
        <div className={`${columns} gap-2`}>
          {tiles.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className="group relative mb-2 block break-inside-avoid overflow-hidden rounded-xl bg-white/5"
              style={{ aspectRatio: `${t.width} / ${t.height}` }}
              aria-label={t.label ?? t.prompt ?? "Open"}
            >
              {t.kind === "video" ? (
                <AutoVideo src={t.url} poster={t.posterUrl} className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- immutable /media route
                <img src={t.url} alt={t.prompt ?? ""} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              )}
              {t.label && (
                <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">{t.label}</span>
              )}
              {t.prompt && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-[11px] text-white/85 opacity-0 transition group-hover:opacity-100">
                  {t.prompt}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <Link href={pill.href} className="rounded-full border border-accent/30 bg-black/70 px-4 py-2 text-sm font-medium text-accent backdrop-blur hover:bg-black">
            {pill.label} ↗
          </Link>
        </div>
      </div>
    </section>
  );
}
