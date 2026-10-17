"use client";

import { Suspense, lazy } from "react";

import { ChartSkeleton } from "@/components/charts/chart-skeleton";
import type { TrendChartProps } from "@/components/charts/trend-chart";

/**
 * Lazily-loaded `TrendChart`.
 *
 * recharts is a sizeable client-only dependency, so its chunk is deferred rather
 * than shipped in the route's initial JS. Charts are not needed for first paint,
 * so a height-matched skeleton is shown while the chunk downloads.
 */
const TrendChart = lazy(() =>
  import("@/components/charts/trend-chart").then((mod) => ({ default: mod.TrendChart })),
);

export function LazyTrendChart(props: TrendChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height ?? 240} />}>
      <TrendChart {...props} />
    </Suspense>
  );
}
