import { type DateOnly, eachDay } from "@/lib/dates";

/**
 * Analytics series helpers.
 *
 * Charts read best as a dense, ordered series with one point per day: a gap in
 * the data should render as zero rather than collapse the axis. Aggregations
 * produced by Prisma only return days that actually have rows, so the series is
 * normalised here before it reaches the UI.
 */

export interface DayPoint {
  date: DateOnly;
  value: number;
}

/**
 * Expands a sparse day series into a dense one spanning `[from, to]`, filling
 * missing days with 0. Points outside the range are dropped. When the input
 * contains the same date twice, the last occurrence wins.
 */
export function zeroFillDays(from: DateOnly, to: DateOnly, data: DayPoint[]): DayPoint[] {
  const byDate = new Map<DateOnly, number>();
  for (const point of data) byDate.set(point.date, point.value);
  return eachDay(from, to).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

/** Journal moods ordered from worst (1) to best (5). */
export const MOOD_SCORES: Record<string, number> = {
  BAD: 1,
  LOW: 2,
  OKAY: 3,
  GOOD: 4,
  GREAT: 5,
};

/**
 * Numeric score (1–5) for a journal mood, or null when the mood is absent or
 * unrecognised. Days without a journal entry have no mood — they are *not*
 * treated as zero, so mood series stay sparse.
 */
export function moodScore(mood: string | null | undefined): number | null {
  if (!mood) return null;
  return MOOD_SCORES[mood] ?? null;
}
