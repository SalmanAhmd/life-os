import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { GoalsView } from "@/features/goals/components/goals-view";
import { listGoalOptions, listGoals } from "@/features/goals/queries";
import { listLifeAreas } from "@/features/life-areas/queries";
import { listTaskOptions } from "@/features/tasks/queries";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [goals, lifeAreas, parentGoals, taskOptions, projects] = await Promise.all([
    listGoals(user.id, { includeArchived: false }),
    listLifeAreas(user.id),
    listGoalOptions(user.id),
    listTaskOptions(user.id),
    db.project.findMany({
      where: { userId: user.id, archivedAt: null, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-muted-foreground text-sm">
          Track your objectives and the milestones that get you there.
        </p>
      </div>
      <GoalsView
        goals={goals}
        today={today}
        lifeAreas={lifeAreas}
        projects={projects}
        parentGoals={parentGoals}
        taskOptions={taskOptions.map((task) => ({ id: task.id, title: task.title }))}
      />
    </div>
  );
}
