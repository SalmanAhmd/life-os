"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { onboardingSchema } from "@/features/onboarding/schemas";
import { provisionUser } from "@/features/onboarding/provision";

export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the details.", zodFieldErrors(parsed.error));

  const { name, timezone, weekStartsOn, timeFormat } = parsed.data;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { name, timezone, onboardedAt: new Date() },
    });
    await tx.scheduleSettings.upsert({
      where: { userId: user.id },
      update: { weekStartsOn, timeFormat },
      create: { userId: user.id, weekStartsOn, timeFormat },
    });
    await tx.userPreferences.upsert({
      where: { userId: user.id },
      update: { weekStartsOn, timeFormat },
      create: { userId: user.id, weekStartsOn, timeFormat },
    });
  });

  await provisionUser(user.id);

  revalidatePath("/dashboard");
  revalidatePath("/today");
  return ok(undefined);
}
