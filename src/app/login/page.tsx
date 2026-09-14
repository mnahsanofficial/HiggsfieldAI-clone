import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Sign in · Higgsfield clone" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const user = await getCurrentUser();
  if (user?.kind === "registered") redirect(target);

  return (
    <main className="flex flex-1 items-center px-4 py-10">
      <AuthCard mode="signin" next={target} isGuest={user?.kind === "guest"} />
    </main>
  );
}
