import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { ANALYTICS_WINDOW_DAYS, getAnalyticsSnapshot } from "@/features/analytics/queries";
import type { GoalProgressPoint } from "@/features/analytics/types";
import { listGoals } from "@/features/goals/queries";

export const metadata: Metadata = { title: "Analytics" };

/** How many goals to plot so the bar chart stays readable. */
const GOAL_CHART_LIMIT = 8;

export default async function AnalyticsPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [snapshot, goals] = await Promise.all([
    getAnalyticsSnapshot(user.id, user.timezone, today),
    listGoals(user.id, { includeArchived: false }),
  ]);

  const goalPoints: GoalProgressPoint[] = goals
    .filter((goal) => goal.status !== "COMPLETED")
    .sort((a, b) => b.progress - a.progress)
    .slice(0, GOAL_CHART_LIMIT)
    .map((goal) => ({
      title: goal.title,
      progress: goal.progress,
      color: goal.lifeArea?.color ?? "var(--chart-1)",
    }));

  return (
    <AnalyticsView snapshot={snapshot} goals={goalPoints} windowDays={ANALYTICS_WINDOW_DAYS} />
  );
}
