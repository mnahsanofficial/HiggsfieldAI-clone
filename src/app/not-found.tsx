import Link from "next/link";

export const metadata = { title: "Not found · Higgsfield clone" };

// Unknown routes get the product's own page with real ways forward, never the framework default.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <p className="text-6xl font-black tracking-tight text-accent">404</p>
      <h1 className="text-2xl font-black uppercase tracking-tight">This shot isn&apos;t in the library</h1>
      <p className="text-sm text-white/55">The page you asked for doesn&apos;t exist. Start from one of these instead.</p>
      <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
        <Link href="/" className="flex h-11 items-center justify-center rounded-xl bg-accent font-semibold text-black">
          Explore
        </Link>
        <Link href="/ai/image" className="flex h-11 items-center justify-center rounded-xl bg-white/10 font-semibold hover:bg-white/15">
          Create image
        </Link>
        <Link href="/ai/video" className="flex h-11 items-center justify-center rounded-xl bg-white/10 font-semibold hover:bg-white/15">
          Create video
        </Link>
      </div>
    </main>
  );
}
