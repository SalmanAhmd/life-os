"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { GoalProgressPoint } from "@/features/analytics/types";
import {
  AXIS_TICK,
  TOOLTIP_CURSOR,
  TOOLTIP_STYLE,
  goalsChartHeight,
} from "@/components/charts/chart-theme";
import { cn, truncate } from "@/lib/utils";

export interface GoalsProgressChartProps {
  goals: GoalProgressPoint[];
  emptyLabel?: string;
  className?: string;
}

/**
 * Horizontal bars comparing goal progress (0–100%). Each bar takes its goal's
 * life-area color, falling back to `--chart-1` when the goal is unassigned.
 */
export function GoalsProgressChart({
  goals,
  emptyLabel = "No active goals yet.",
  className,
}: GoalsProgressChartProps) {
  if (goals.length === 0) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center text-sm",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  // Grow with the number of bars so labels never overlap.
  const height = goalsChartHeight(goals.length);

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={goals} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="title"
            width={140}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickFormatter={(value) => truncate(String(value), 22)}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "Progress"]}
            cursor={TOOLTIP_CURSOR}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="progress" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {goals.map((goal, index) => (
              <Cell key={`${goal.title}-${index}`} fill={goal.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
