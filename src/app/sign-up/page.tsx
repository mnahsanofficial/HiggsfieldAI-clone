import { redirect } from "next/navigation";
import { AuthForm } from "@/components/docket/auth/auth-form";
import { ROUTES } from "@/components/docket/routes";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Create an account" };

export default async function Page({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams;
  // Only same-site paths, so ?next= can't send anyone off-site.
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.home;
  const user = await getCurrentUser();
  if (user?.kind === "registered") redirect(target);
  return <AuthForm mode="sign-up" next={target} isGuest={user?.kind === "guest"} />;
}
