import {
  type DateOnly,
  addDays,
  dayOfMonth,
  eachDay,
  startOfWeek,
  weekdayOf,
  diffDays,
} from "@/lib/dates";

/**
 * Working-day rules.
 *
 * The effective schedule is decided in this precedence order:
 *   1. Exceptional working days always win (a holiday that you decided to work).
 *   2. Holidays always make a day non-working.
 *   3. Saturdays are decided by the configured Saturday rule.
 *   4. All other days use the explicit `workingDays` list.
 *
 * Rules are pure and fully unit-tested (tests/unit/working-days.test.ts).
 */
export type SaturdayRule =
  | "ALL_OFF"
  | "ALTERNATE_OFF"
  | "SECOND_FOURTH_OFF"
  | "ALL_WORKING"
  | "CUSTOM";

export interface Holiday {
  date: DateOnly;
  name: string;
}

export interface ScheduleConfig {
  saturdayRule: SaturdayRule;
  /** Explicit working weekdays (0=Sun..6=Sat). Used for non-Saturday & CUSTOM. */
  workingDays: number[];
  /** Weeks between working Saturdays when rule is ALTERNATE_OFF (>= 2). */
  alternateSaturdayWeeks: number;
  /** A known working Saturday that anchors the alternation parity. */
  alternateSaturdayAnchor: DateOnly | null;
  holidays: Holiday[];
  exceptionalWorkdays: DateOnly[];
}

export const DEFAULT_ALTERNATE_ANCHOR: DateOnly = "2026-01-03"; // first Saturday of 2026

/** 1-based index of a Saturday within its month (1 = first Saturday). */
export function nthSaturdayOfMonth(date: DateOnly): number {
  return Math.ceil(dayOfMonth(date) / 7);
}

function isNthSaturdayOfMonth(date: DateOnly, nth: number): boolean {
  return nthSaturdayOfMonth(date) === nth;
}

function resolveAlternateSaturday(date: DateOnly, anchor: DateOnly | null, weeks: number): boolean {
  const every = Math.max(2, Math.floor(weeks));
  const anchorWeek = startOfWeek(anchor ?? DEFAULT_ALTERNATE_ANCHOR, 1);
  const targetWeek = startOfWeek(date, 1);
  const weekIndex = Math.round(diffDays(anchorWeek, targetWeek) / 7);
  // Normalize negatives so parity is stable for dates before the anchor.
  const normalized = ((weekIndex % every) + every) % every;
  return normalized === 0;
}

/** Is this particular Saturday a working day under the given rule? */
export function isSaturdayWorking(date: DateOnly, config: ScheduleConfig): boolean {
  switch (config.saturdayRule) {
    case "ALL_WORKING":
      return true;
    case "ALL_OFF":
      return false;
    case "SECOND_FOURTH_OFF":
      return !(isNthSaturdayOfMonth(date, 2) || isNthSaturdayOfMonth(date, 4));
    case "ALTERNATE_OFF":
      return resolveAlternateSaturday(
        date,
        config.alternateSaturdayAnchor,
        config.alternateSaturdayWeeks,
      );
    case "CUSTOM":
      return config.workingDays.includes(6);
  }
}

function holidaySet(config: ScheduleConfig): Set<string> {
  return new Set(config.holidays.map((h) => h.date));
}

export function isWorkingDay(date: DateOnly, config: ScheduleConfig): boolean {
  if (config.exceptionalWorkdays.includes(date)) return true;
  if (holidaySet(config).has(date)) return false;
  const dow = weekdayOf(date);
  if (dow === 6) return isSaturdayWorking(date, config);
  return config.workingDays.includes(dow);
}

export function isNonWorkingDay(date: DateOnly, config: ScheduleConfig): boolean {
  return !isWorkingDay(date, config);
}

export function getWorkingDaysInRange(from: DateOnly, to: DateOnly, config: ScheduleConfig): DateOnly[] {
  return eachDay(from, to).filter((date) => isWorkingDay(date, config));
}

/**
 * Effective working weekdays for a representative week, computed by walking a
 * real week so month-dependent Saturday rules are evaluated against actual
 * dates in context.
 */
export function effectiveWorkingWeekdays(
  referenceDate: DateOnly,
  weekStartsOn: number,
  config: ScheduleConfig,
): number[] {
  const start = startOfWeek(referenceDate, weekStartsOn);
  const result: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (isWorkingDay(day, config)) result.push(weekdayOf(day));
  }
  return result;
}

/** Count working days in a month — used by the schedule preview UI. */
export function workingDayCountForMonth(
  year: number,
  month: number,
  config: ScheduleConfig,
): number {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return getWorkingDaysInRange(from, to, config).length;
}
