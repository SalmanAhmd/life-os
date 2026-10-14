import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardedAt) redirect("/dashboard");

  const schedule = await db.scheduleSettings.findUnique({ where: { userId: user.id } });

  return (
    <OnboardingForm
      defaults={{
        name: user.name ?? "",
        timezone: user.timezone,
        weekStartsOn: schedule?.weekStartsOn ?? 1,
        timeFormat: (schedule?.timeFormat as "12h" | "24h" | undefined) ?? "24h",
      }}
    />
  );
}
