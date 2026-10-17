"use client";

import { Suspense, lazy } from "react";

import { ChartSkeleton } from "@/components/charts/chart-skeleton";
import type { DistributionChartProps } from "@/components/charts/distribution-chart";

/** Lazily-loaded `DistributionChart`; see `lazy-trend-chart.tsx` for rationale. */
const DistributionChart = lazy(() =>
  import("@/components/charts/distribution-chart").then((mod) => ({
    default: mod.DistributionChart,
  })),
);

export function LazyDistributionChart(props: DistributionChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height ?? 200} />}>
      <DistributionChart {...props} />
    </Suspense>
  );
}
