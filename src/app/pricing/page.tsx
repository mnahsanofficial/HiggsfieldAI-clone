import { PlanCards } from "@/components/billing/plan-cards";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPlans } from "@/lib/billing/plans";

export const metadata = { title: "Pricing · Higgsfield clone" };

export default async function PricingPage() {
  const [user, plans] = await Promise.all([getCurrentUser(), listPlans()]);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-8 sm:px-4">
      <h1 className="text-center text-3xl font-black uppercase tracking-tight sm:text-5xl">
        Credits that turn into <span className="text-accent">shots</span>
      </h1>
      <p className="mx-auto mb-6 mt-2 max-w-xl text-center text-sm text-white/55">Every plan is credits per month. Every generation shows its price before you press Generate.</p>
      <PlanCards plans={plans} currentPlanId={user?.planId ?? null} signedIn={!!user} />
    </main>
  );
}
