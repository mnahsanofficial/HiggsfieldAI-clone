import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { readSessionUserId } from "./session";

export type CurrentUser = {
  id: string;
  kind: "guest" | "registered";
  email: string | null;
  displayName: string;
  planId: string;
  creditBalanceTenths: number;
};

// A valid cookie is not enough: the user row must still exist.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const [user] = await db
    .select({
      id: users.id,
      kind: users.kind,
      email: users.email,
      displayName: users.displayName,
      planId: users.planId,
      creditBalanceTenths: users.creditBalanceTenths,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
});
