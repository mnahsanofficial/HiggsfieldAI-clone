// Deploy-pipeline placeholder: the barest page that proves build and deploy work.
// Replaced by Explore in feat/explore.
export default function Home() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const env = process.env.VERCEL_ENV ?? "development";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-white/50">
        Deploy pipeline
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        HIGGSFIELD <span className="text-accent">CLONE</span>
      </h1>
      <p className="font-mono text-sm text-white/60">
        {env} · {commit}
      </p>
    </main>
  );
}
