import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { HabitsView } from "@/features/habits/components/habits-view";
import { listHabits } from "@/features/habits/queries";
import { listLifeAreas } from "@/features/life-areas/queries";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [habits, lifeAreas] = await Promise.all([
    listHabits(user.id, today, { includeArchived: true }),
    listLifeAreas(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
        <p className="text-muted-foreground text-sm">Build streaks and stay consistent.</p>
      </div>
      <HabitsView habits={habits} lifeAreas={lifeAreas} today={today} />
    </div>
  );
}
