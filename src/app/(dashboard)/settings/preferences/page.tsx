import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { getPreferences } from "@/features/settings/queries";
import { PreferencesForm } from "@/features/settings/components/preferences-form";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesSettingsPage() {
  const user = await requireUser();
  const prefs = await getPreferences(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-muted-foreground text-sm">
          Theme, week start, time format and reward rules.
        </p>
      </div>
      <PreferencesForm
        defaultValues={{
          theme: (prefs?.theme ?? "system") as "light" | "dark" | "system",
          weekStartsOn: (prefs?.weekStartsOn ?? 1) as 0 | 1,
          timeFormat: (prefs?.timeFormat ?? "24h") as "12h" | "24h",
          defaultTaskView: (prefs?.defaultTaskView ?? "list") as "list" | "table" | "board",
          pointsPerTask: prefs?.pointsPerTask ?? 10,
          pointsPerHighPriority: prefs?.pointsPerHighPriority ?? true,
          highPriorityBonus: prefs?.highPriorityBonus ?? 5,
          pointsPerHabit: prefs?.pointsPerHabit ?? 5,
          pointsPerMilestone: prefs?.pointsPerMilestone ?? 25,
          perfectDayBonus: prefs?.perfectDayBonus ?? 20,
          perfectDayEnabled: prefs?.perfectDayEnabled ?? false,
        }}
      />
    </div>
  );
}