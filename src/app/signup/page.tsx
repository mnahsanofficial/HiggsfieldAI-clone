import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "Sign up · Higgsfield clone" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const user = await getCurrentUser();
  if (user?.kind === "registered") redirect(target);

  return (
    <main className="flex flex-1 items-center px-4 py-10">
      <AuthCard mode="signup" next={target} isGuest={user?.kind === "guest"} />
    </main>
  );
}
