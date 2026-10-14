import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

/**
 * The authorization boundary for reads.
 *
 * `getSessionUser` resolves the session's user id (from a signed JWT) and loads
 * the matching database record. The browser never supplies a user id that we
 * trust — every query is scoped with the id returned here.
 *
 * `cache` deduplicates the lookup within a single request.
 */
export const getSessionUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  return db.user.findUnique({
    where: { id: userId },
    include: { preferences: true, schedule: true },
  });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** Redirects to sign-in when there is no valid session. Use in pages/actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Requires a session *and* completed onboarding. */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");
  return user;
}
