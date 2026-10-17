import "server-only";

import {
  type DateOnly,
  addDays,
  compareDateOnly,
  dateOnlyToDb,
  dbDateToDateOnly,
  localDateOnly,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { type DayPoint, moodScore, zeroFillDays } from "@/lib/analytics/series";
import { pointsByDay } from "@/features/rewards/queries";
import type { AnalyticsSnapshot, TaskStatusCount } from "@/features/analytics/types";

/** Rolling window length for the analytics trend charts, in days. */
export const ANALYTICS_WINDOW_DAYS = 30;

/** One extra day on each side covers timezone offsets at the range edges. */
const WINDOW_PADDING_DAYS = 1;

/**
 * Completed tasks per day across `[from, to]`, including recurring occurrences.
 *
 * `TaskCompletion` receives a row for every completion (simple tasks *and*
 * occurrences — see the task actions), so it is the single source of truth for
 * completion history. Timestamps are instants, so they are bucketed into the
 * user's timezone: "which day did I complete this?" is answered where the user
 * lives, not in UTC.
 */
export async function getTaskCompletionSeries(
  userId: string,
  timezone: string,
  from: DateOnly,
  to: DateOnly,
): Promise<DayPoint[]> {
  const rows = await db.taskCompletion.findMany({
    where: {
      userId,
      completedAt: {
        gte: dateOnlyToDb(addDays(from, -WINDOW_PADDING_DAYS)),
        lt: new Date(dateOnlyToDb(addDays(to, WINDOW_PADDING_DAYS)).getTime() + 86_400_000),
      },
    },
    select: { completedAt: true },
  });

  const totals = new Map<DateOnly, number>();
  for (const row of rows) {
    const date = localDateOnly(row.completedAt, timezone);
    if (compareDateOnly(date, from) < 0 || compareDateOnly(date, to) > 0) continue;
    totals.set(date, (totals.get(date) ?? 0) + 1);
  }

  return zeroFillDays(
    from,
    to,
    Array.from(totals, ([date, value]) => ({ date, value })),
  );
}

/**
 * Top-level, non-archived, non-recurring tasks grouped by status.
 *
 * Recurring tasks are excluded deliberately: their template row stays `TODO`
 * forever while the real progress lives on occurrences, so mixing the two would
 * misreport. Subtasks are excluded too, to count each piece of work once.
 */
export async function getTaskStatusDistribution(userId: string): Promise<TaskStatusCount[]> {
  const grouped = await db.task.groupBy({
    by: ["status"],
    where: { userId, archivedAt: null, parentTaskId: null, isRecurring: false },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Habit check-ins per day across `[from, to]`. A check-in row exists for each
 * habit logged on a date, so this counts how many habits were checked off that
 * day. `HabitCheckIn.date` is already a DateOnly, making it timezone-free.
 */
export async function getHabitCheckInSeries(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): Promise<DayPoint[]> {
  const rows = await db.habitCheckIn.findMany({
    where: { userId, date: { gte: dateOnlyToDb(from), lte: dateOnlyToDb(to) } },
    select: { date: true },
  });

  const totals = new Map<DateOnly, number>();
  for (const row of rows) {
    const date = dbDateToDateOnly(row.date);
    totals.set(date, (totals.get(date) ?? 0) + 1);
  }

  return zeroFillDays(
    from,
    to,
    Array.from(totals, ([date, value]) => ({ date, value })),
  );
}

/**
 * Journal moods logged in `[from, to]` as numeric scores (1–5).
 *
 * Intentionally sparse: a day with no journal entry has *no* mood rather than a
 * zero, so entries are returned only for days that were actually logged.
 */
export async function getJournalMoodSeries(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): Promise<DayPoint[]> {
  const rows = await db.journalEntry.findMany({
    where: {
      userId,
      date: { gte: dateOnlyToDb(from), lte: dateOnlyToDb(to) },
      mood: { not: null },
    },
    select: { date: true, mood: true },
    orderBy: { date: "asc" },
  });

  return rows
    .map((row) => ({ date: dbDateToDateOnly(row.date), value: moodScore(row.mood) }))
    .filter((point): point is DayPoint => point.value != null);
}

/**
 * Everything the analytics dashboard renders, in one round trip.
 *
 * The window ends at `today` in the user's timezone and spans
 * `ANALYTICS_WINDOW_DAYS` days. Points reuse the rewards feature's own series so
 * the numbers cannot drift between the two pages.
 */
export async function getAnalyticsSnapshot(
  userId: string,
  timezone: string,
  today: DateOnly,
): Promise<AnalyticsSnapshot> {
  const from = addDays(today, -(ANALYTICS_WINDOW_DAYS - 1));

  const [completions, rawPoints, checkIns, moods, taskStatus] = await Promise.all([
    getTaskCompletionSeries(userId, timezone, from, today),
    pointsByDay(userId, from, today),
    getHabitCheckInSeries(userId, from, today),
    getJournalMoodSeries(userId, from, today),
    getTaskStatusDistribution(userId),
  ]);

  return {
    range: { from, to: today },
    completions,
    points: zeroFillDays(
      from,
      today,
      rawPoints.map((point) => ({ date: point.date, value: point.points })),
    ),
    checkIns,
    moods,
    taskStatus,
  };
}
