import type { DateOnly } from "@/lib/dates";
import type { DayPoint } from "@/lib/analytics/series";

/**
 * Analytics view-model types.
 *
 * Kept free of `server-only` so client chart components can import them; the
 * data itself is always assembled on the server (see queries.ts).
 */

export type { DayPoint };

export interface TaskStatusCount {
  status: string;
  count: number;
}

/** A single goal bar in the goal-progress chart. */
export interface GoalProgressPoint {
  title: string;
  progress: number;
  color: string;
}

export interface AnalyticsSnapshot {
  /** Inclusive date range the trend series cover. */
  range: { from: DateOnly; to: DateOnly };
  completions: DayPoint[];
  points: DayPoint[];
  checkIns: DayPoint[];
  moods: DayPoint[];
  taskStatus: TaskStatusCount[];
}
