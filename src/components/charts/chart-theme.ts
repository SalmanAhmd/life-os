import type { CSSProperties } from "react";

/**
 * Shared recharts styling, kept in one place so every chart looks consistent.
 *
 * This module must stay free of recharts imports: the lazy chart wrappers read
 * the geometry constants here without pulling the chart lib into their chunk.
 */

/** Axis tick styling (recharts `tick` prop). */
export const AXIS_TICK = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

/** Tooltip container styling (recharts `contentStyle` prop). */
export const TOOLTIP_STYLE: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--card-foreground)",
  fontSize: 12,
};

/** Cursor highlight drawn behind the hovered bar/area. */
export const TOOLTIP_CURSOR = { fill: "var(--muted)", opacity: 0.4 } as const;

/** Height of one row in the goals progress chart. */
export const GOAL_BAR_ROW_HEIGHT = 40;

/** Minimum height of the goals progress chart. */
export const GOAL_CHART_MIN_HEIGHT = 180;

/** Chart height for a list of goals, growing with the number of bars. */
export function goalsChartHeight(goalCount: number): number {
  return Math.max(GOAL_CHART_MIN_HEIGHT, goalCount * GOAL_BAR_ROW_HEIGHT);
}
