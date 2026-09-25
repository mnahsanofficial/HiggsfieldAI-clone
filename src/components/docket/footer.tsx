// A quiet footer for reviewers moving between the app and the code: the source, how it was
// built, and who built it.
const REPO = "https://github.com/mnahsanofficial/docket-nahsan";

export function DocketFooter() {
  const link = "inline-block py-2 underline underline-offset-2 hover:text-ink";
  return (
    <footer className="mt-16 border-t border-line">
      <div className="t-meta mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-0 px-4 py-4">
        <a href={REPO} className={link}>
          Source on GitHub
        </a>
        <a href={`${REPO}#how-it-was-built`} className={link}>
          How it was built
        </a>
        <span className="py-2">Built by Nazmul Ahsan</span>
      </div>
    </footer>
  );
}
