"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DayPoint } from "@/lib/analytics/series";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** "Wed, Oct 14" -> "Oct 14", compact enough for axis ticks. */
function shortDate(date: string): string {
  return formatDateOnly(date).split(", ")[1] ?? date;
}

const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--card-foreground)",
  fontSize: 12,
} as const;

export interface TrendChartProps {
  data: DayPoint[];
  variant?: "area" | "bar" | "line";
  /** Any CSS color, including theme variables such as `var(--chart-1)`. */
  color?: string;
  height?: number;
  valueLabel?: string;
  yDomain?: [number, number];
  emptyLabel?: string;
  className?: string;
}

/**
 * Shared day-bucketed trend chart.
 *
 * Renders a friendly message when every point is zero rather than an empty
 * frame, so a blank chart is never mistaken for a loading failure.
 */
export function TrendChart({
  data,
  variant = "area",
  color = "var(--chart-1)",
  height = 240,
  valueLabel = "Total",
  yDomain,
  emptyLabel = "No data for this period yet.",
  className,
}: TrendChartProps) {
  // Sanitised so the value is safe to use in an SVG `url(#...)` reference.
  const gradientId = `trend-${useId().replace(/:/g, "")}`;
  const hasData = data.some((point) => point.value !== 0);

  if (!hasData) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm",
          className,
        )}
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey="date"
        tickFormatter={shortDate}
        tickLine={false}
        axisLine={false}
        tick={AXIS_TICK}
        minTickGap={24}
      />
      <YAxis
        width={36}
        allowDecimals={false}
        domain={yDomain}
        tickLine={false}
        axisLine={false}
        tick={AXIS_TICK}
      />
      <Tooltip
        labelFormatter={(label) => formatDateOnly(String(label))}
        formatter={(value) => [value, valueLabel]}
        contentStyle={TOOLTIP_STYLE}
        labelStyle={{ color: "var(--muted-foreground)" }}
        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
      />
    </>
  );

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {axes}
            <Bar
              dataKey="value"
              name={valueLabel}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        ) : variant === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {axes}
            <Line
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              type="monotone"
              dataKey="value"
              name={valueLabel}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
