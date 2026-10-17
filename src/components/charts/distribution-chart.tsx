"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export interface DistributionSlice {
  label: string;
  value: number;
  /** Any CSS color, including theme variables such as `var(--chart-1)`. */
  color: string;
}

/**
 * Donut chart with a themed legend for "counts by category" breakdowns.
 *
 * The legend is rendered as plain markup rather than recharts' own `<Legend>`
 * so it inherits the app's typography and shows the percentage alongside each
 * raw count.
 */
export function DistributionChart({
  slices,
  height = 200,
  valueLabel = "Count",
  emptyLabel = "No data yet.",
  className,
}: {
  slices: DistributionSlice[];
  height?: number;
  valueLabel?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const total = slices.reduce((acc, slice) => acc + slice.value, 0);

  if (total === 0) {
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

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:gap-6", className)}>
      <div className="shrink-0" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [value, valueLabel]}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--card-foreground)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {slice.value} · {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
