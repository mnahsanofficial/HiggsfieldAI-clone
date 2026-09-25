import { ButtonLink } from "@/components/ui/button";
import { ROUTES } from "@/components/docket/routes";

export const metadata = { title: "Not found" };

// Unknown paths get a real way forward, never a dead end.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
      <h1 className="t-display">There&apos;s nothing at this address</h1>
      <p className="t-body text-muted">It may have moved when this app became Docket. Everything it did is still here.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ButtonLink href={ROUTES.make}>Make something</ButtonLink>
        <ButtonLink href={ROUTES.home} variant="secondary">
          Home
        </ButtonLink>
      </div>
    </main>
  );
}
