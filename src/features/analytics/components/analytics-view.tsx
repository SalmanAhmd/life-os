"use client";

import type { ReactNode } from "react";

import type { DistributionSlice } from "@/components/charts/distribution-chart";
import { LazyDistributionChart } from "@/components/charts/lazy-distribution-chart";
import { LazyTrendChart } from "@/components/charts/lazy-trend-chart";
import { LazyGoalsProgressChart } from "@/features/analytics/components/lazy-goals-progress-chart";
import type { AnalyticsSnapshot, GoalProgressPoint } from "@/features/analytics/types";
import { formatDateOnly } from "@/lib/dates";
import { cn, sum } from "@/lib/utils";

/** Display order and colors for task-status slices. */
const STATUS_ORDER = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const STATUS_META: Record<string, { label: string; color: string }> = {
  TODO: { label: "To do", color: "var(--chart-3)" },
  IN_PROGRESS: { label: "In progress", color: "var(--chart-1)" },
  COMPLETED: { label: "Completed", color: "var(--chart-2)" },
  CANCELLED: { label: "Cancelled", color: "var(--muted-foreground)" },
};

function toStatusSlices(taskStatus: AnalyticsSnapshot["taskStatus"]): DistributionSlice[] {
  const countFor = (status: string) =>
    taskStatus.find((item) => item.status === status)?.count ?? 0;

  const slices = STATUS_ORDER.map((status) => ({
    label: STATUS_META[status].label,
    color: STATUS_META[status].color,
    value: countFor(status),
  })).filter((slice) => slice.value > 0);

  // Surface any status the UI does not know about rather than silently dropping
  // it — a new enum value should never make the totals disagree with reality.
  for (const item of taskStatus) {
    if (!STATUS_META[item.status] && item.count > 0) {
      slices.push({ label: item.status, color: "var(--muted-foreground)", value: item.count });
    }
  }

  return slices;
}

export function AnalyticsView({
  snapshot,
  goals,
  windowDays,
}: {
  snapshot: AnalyticsSnapshot;
  goals: GoalProgressPoint[];
  windowDays: number;
}) {
  const { completions, points, checkIns, moods } = snapshot;
  const statusSlices = toStatusSlices(snapshot.taskStatus);

  const completionTotal = sum(completions.map((point) => point.value));
  const pointsTotal = sum(points.map((point) => point.value));
  const checkInTotal = sum(checkIns.map((point) => point.value));

  const windowLabel = `${formatDateOnly(snapshot.range.from, { withYear: true })} – ${formatDateOnly(
    snapshot.range.to,
    { withYear: true },
  )}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Trends across tasks, habits, rewards and journaling —{" "}
          <span className="whitespace-nowrap">
            {windowDays} days ending {formatDateOnly(snapshot.range.to, { withYear: true })}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tasks completed"
          value={completionTotal}
          description={`Last ${windowDays} days`}
        />
        <StatCard
          title="Points earned"
          value={pointsTotal}
          description={`Last ${windowDays} days`}
        />
        <StatCard
          title="Habit check-ins"
          value={checkInTotal}
          description={`Last ${windowDays} days`}
        />
        <StatCard title="Mood entries" value={moods.length} description="Days journaled" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Task completions"
          description={`Completed per day · ${windowLabel}`}
          className="lg:col-span-2"
        >
          <LazyTrendChart
            data={completions}
            valueLabel="Completed"
            emptyLabel="Complete a task to start building your streak."
          />
        </ChartCard>

        <ChartCard title="Tasks by status" description="Top-level, active tasks">
          <LazyDistributionChart
            slices={statusSlices}
            valueLabel="Tasks"
            emptyLabel="No tasks yet."
          />
        </ChartCard>

        <ChartCard title="Points earned" description={`Per day · last ${windowDays} days`}>
          <LazyTrendChart
            data={points}
            color="var(--chart-2)"
            valueLabel="Points"
            emptyLabel="Earn points by completing tasks, habits and milestones."
          />
        </ChartCard>

        <ChartCard
          title="Habit check-ins"
          description={`Check-ins per day · last ${windowDays} days`}
        >
          <LazyTrendChart
            data={checkIns}
            variant="bar"
            color="var(--chart-3)"
            valueLabel="Check-ins"
            emptyLabel="Check in to a habit to see it here."
          />
        </ChartCard>

        <ChartCard title="Mood" description="Score on days you journaled (1 = bad, 5 = great)">
          <LazyTrendChart
            data={moods}
            variant="line"
            color="var(--chart-4)"
            valueLabel="Mood (1–5)"
            yDomain={[0, 5]}
            emptyLabel="Log a mood in your journal to track how you feel."
          />
        </ChartCard>

        <ChartCard
          title="Goal progress"
          description="Your most advanced active goals"
          className="lg:col-span-2"
        >
          <LazyGoalsProgressChart
            goals={goals}
            emptyLabel="Create a goal to track progress here."
          />
        </ChartCard>
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
      <p className="text-muted-foreground text-sm">{title}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border/70 bg-card flex flex-col gap-4 rounded-lg border p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
