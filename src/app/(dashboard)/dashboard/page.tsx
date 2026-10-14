import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { getTaskStats } from "@/features/tasks/queries";
import { getPointsBalance } from "@/features/rewards/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [taskStats, points] = await Promise.all([
    getTaskStats(user.id, today),
    getPointsBalance(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          A quick overview of what is happening today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today" value={taskStats.today} description="Tasks for today" />
        <StatCard title="Overdue" value={taskStats.overdue} description="Past due" />
        <StatCard title="Upcoming" value={taskStats.upcoming} description="Next 30 days" />
        <StatCard title="Points" value={points} description="Total earned" />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="border-border/70 bg-card flex flex-col gap-1 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm font-medium">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}
