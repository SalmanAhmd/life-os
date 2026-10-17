"use client";

import { Suspense, lazy } from "react";

import { ChartSkeleton } from "@/components/charts/chart-skeleton";
import { goalsChartHeight } from "@/components/charts/chart-theme";
import type { GoalsProgressChartProps } from "@/features/analytics/components/goals-progress-chart";

/** Lazily-loaded `GoalsProgressChart`; see `lazy-trend-chart.tsx` for rationale. */
const GoalsProgressChart = lazy(() =>
  import("@/features/analytics/components/goals-progress-chart").then((mod) => ({
    default: mod.GoalsProgressChart,
  })),
);

export function LazyGoalsProgressChart(props: GoalsProgressChartProps) {
  return (
    <Suspense
      fallback={
        <ChartSkeleton height={goalsChartHeight(props.goals.length)} className={props.className} />
      }
    >
      <GoalsProgressChart {...props} />
    </Suspense>
  );
}
