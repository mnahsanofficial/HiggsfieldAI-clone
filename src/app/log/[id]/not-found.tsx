import { ButtonLink } from "@/components/ui/button";
import { ROUTES } from "@/components/docket/routes";

// Same answer for "private" and "doesn't exist", so a link can't be used to probe for runs.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
      <h1 className="t-title">This run isn&apos;t public, or it doesn&apos;t exist</h1>
      <p className="t-body text-muted">Runs are private until their owner publishes them. If it&apos;s yours, sign in with the account that made it.</p>
      <ButtonLink href={ROUTES.make} className="mt-2">
        Make something
      </ButtonLink>
    </main>
  );
}
