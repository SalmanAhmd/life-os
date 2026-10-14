import {
  type DateOnly,
  addDays,
  addWeeks,
  compareDateOnly,
  eachDay,
  startOfWeek,
  weekdayOf,
} from "@/lib/dates";

/**
 * Habit scheduling, streaks and completion rates.
 *
 * Semantics (documented so the UI can explain itself):
 * - A habit is measured in **periods**. For DAILY and CUSTOM the period is a
 *   scheduled day; for WEEKLY the period is a week.
 * - A period is *completed* when the summed value for that period reaches
 *   `targetPerPeriod`. A boolean habit has `targetPerPeriod = 1`.
 * - **Streak** = consecutive completed periods, ignoring days that are not
 *   scheduled. The current period is granted a grace window: if today is
 *   scheduled but not yet completed, it does not break the streak.
 * - Habit check-ins are a separate record type from task completions. Linking a
 *   task to a habit does not auto-create a check-in (no duplicate completions).
 */
export type HabitFrequency = "DAILY" | "WEEKLY" | "CUSTOM";

export interface HabitDefinition {
  frequency: HabitFrequency;
  /** Scheduled weekdays for CUSTOM habits (0=Sun..6=Sat). */
  weekdays: number[];
  targetPerPeriod: number;
  createdAt: DateOnly;
}

export interface HabitCheckInLike {
  date: DateOnly;
  value: number;
}

export interface StreakResult {
  current: number;
  best: number;
  unit: "day" | "week";
}

function target(habit: HabitDefinition): number {
  return Math.max(1, Math.floor(habit.targetPerPeriod) || 1);
}

export function isScheduledOn(habit: HabitDefinition, date: DateOnly): boolean {
  if (habit.frequency === "WEEKLY") return true;
  if (habit.frequency === "DAILY") return true;
  if (habit.weekdays.length === 0) return true;
  return habit.weekdays.includes(weekdayOf(date));
}

function valueByDate(checkIns: HabitCheckInLike[]): Map<DateOnly, number> {
  const map = new Map<DateOnly, number>();
  for (const checkIn of checkIns) {
    map.set(checkIn.date, (map.get(checkIn.date) ?? 0) + checkIn.value);
  }
  return map;
}

/** Sum of check-in values for the week starting at `weekStart`. */
function weeklyValue(map: Map<DateOnly, number>, weekStart: DateOnly): number {
  let total = 0;
  for (let i = 0; i < 7; i += 1) {
    total += map.get(addDays(weekStart, i)) ?? 0;
  }
  return total;
}

export function computeStreaks(
  habit: HabitDefinition,
  checkIns: HabitCheckInLike[],
  today: DateOnly,
  weekStartsOn = 1,
): StreakResult {
  const map = valueByDate(checkIns);
  const need = target(habit);

  if (habit.frequency === "WEEKLY") {
    const firstWeek = startOfWeek(
      earliestDate(checkIns, habit.createdAt),
      weekStartsOn,
    );
    const currentWeek = startOfWeek(today, weekStartsOn);
    const weeks: DateOnly[] = [];
    for (let w = firstWeek; compareDateOnly(w, currentWeek) <= 0; w = addWeeks(w, 1)) {
      weeks.push(w);
    }
    const completed = weeks.map((w) => weeklyValue(map, w) >= need);
    const best = longestRun(completed);
    let current = 0;
    let idx = weeks.length - 1;
    // Grace: the in-progress current week does not break the streak.
    if (idx >= 0 && weeks[idx] === currentWeek && !completed[idx]) idx -= 1;
    while (idx >= 0 && completed[idx]) {
      current += 1;
      idx -= 1;
    }
    return { current, best, unit: "week" };
  }

  const since = earliestDate(checkIns, habit.createdAt);
  const scheduled = eachDay(since, today).filter((date) => isScheduledOn(habit, date));
  const completed = scheduled.map((date) => (map.get(date) ?? 0) >= need);
  const best = longestRun(completed);
  let current = 0;
  let idx = scheduled.length - 1;
  if (idx >= 0 && scheduled[idx] === today && !completed[idx]) idx -= 1;
  while (idx >= 0 && completed[idx]) {
    current += 1;
    idx -= 1;
  }
  return { current, best, unit: "day" };
}

function longestRun(flags: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const flag of flags) {
    run = flag ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function earliestDate(checkIns: HabitCheckInLike[], fallback: DateOnly): DateOnly {
  let earliest = fallback;
  for (const checkIn of checkIns) {
    if (compareDateOnly(checkIn.date, earliest) < 0) earliest = checkIn.date;
  }
  return earliest;
}

/**
 * Completion rate as a 0..100 integer over `[from, to]`.
 * The current in-progress week/day is included in the denominator only once it
 * is fully elapsed — otherwise today would always drag the rate down.
 */
export function completionRate(
  habit: HabitDefinition,
  checkIns: HabitCheckInLike[],
  from: DateOnly,
  to: DateOnly,
  today: DateOnly,
  weekStartsOn = 1,
): number {
  const map = valueByDate(checkIns);
  const need = target(habit);

  if (habit.frequency === "WEEKLY") {
    const firstWeek = startOfWeek(from, weekStartsOn);
    const lastWeek = startOfWeek(to, weekStartsOn);
    const currentWeek = startOfWeek(today, weekStartsOn);
    let expected = 0;
    let completed = 0;
    for (let w = firstWeek; compareDateOnly(w, lastWeek) <= 0; w = addWeeks(w, 1)) {
      if (compareDateOnly(w, currentWeek) >= 0) continue; // exclude in-progress week
      expected += 1;
      if (weeklyValue(map, w) >= need) completed += 1;
    }
    if (expected === 0) return 0;
    return Math.round((completed / expected) * 100);
  }

  const scheduled = eachDay(from, to).filter((date) => isScheduledOn(habit, date));
  const expected = scheduled.filter((date) => compareDateOnly(date, today) < 0);
  if (expected.length === 0) return 0;
  const completed = expected.filter((date) => (map.get(date) ?? 0) >= need).length;
  return Math.round((completed / expected.length) * 100);
}

/** Has the habit met its target for the given day (for heatmaps/checklists)? */
export function isCompletedOn(
  habit: HabitDefinition,
  checkIns: HabitCheckInLike[],
  date: DateOnly,
): boolean {
  if (habit.frequency === "WEEKLY") {
    const week = startOfWeek(date, 1);
    return weeklyValue(valueByDate(checkIns), week) >= target(habit);
  }
  return (valueByDate(checkIns).get(date) ?? 0) >= target(habit);
}
