import {
  type DateOnly,
  addDays,
  addMonths,
  addWeeks,
  compareDateOnly,
  dayOfMonth,
  daysInMonth,
  isDateOnly,
  monthName,
  monthOf,
  startOfMonth,
  startOfWeek,
  weekdayName,
  weekdayOf,
  yearOf,
} from "@/lib/dates";

/**
 * Recurrence engine.
 *
 * A recurrence is a *definition*, stored separately from task occurrences.
 * Occurrences are generated on demand within a bounded window — we never
 * materialise an unbounded series.
 *
 * COUNT semantics: `count` limits the number of *scheduled* occurrences from
 * `startDate`, before exclusions are removed (mirrors RFC 5545 COUNT). Excluded
 * dates (exclusions) are removed from the result but still consume the count.
 *
 * Invalid dates are skipped, never clamped, so a "31st of the month" rule
 * simply does not fire in February. This is predictable and DST-safe because
 * all arithmetic is UTC-based (see src/lib/dates).
 */
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceDefinition {
  frequency: RecurrenceFrequency;
  interval: number;
  byWeekday: number[];
  byMonthDay: number | null;
  bySetPos: number | null;
  byWeekdayForSetPos: number | null;
  byMonth: number | null;
  startDate: DateOnly;
  endDate: DateOnly | null;
  count: number | null;
  exclusions: DateOnly[];
}

export interface OccurrenceQuery {
  from?: DateOnly;
  to?: DateOnly;
  limit?: number;
}

const MAX_SAFETY = 20_000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function monthStart(year: number, month: number): DateOnly {
  return `${year}-${pad2(month)}-01`;
}

/** Returns the date of the nth weekday (pos 1..4 or -1 for last) in a month. */
export function nthWeekdayOfMonth(
  monthFirstDay: DateOnly,
  weekday: number,
  pos: number,
): DateOnly | null {
  const year = yearOf(monthFirstDay);
  const month = monthOf(monthFirstDay);
  const total = daysInMonth(monthFirstDay);

  if (pos === -1) {
    for (let day = total; day >= 1; day -= 1) {
      const candidate = `${year}-${pad2(month)}-${pad2(day)}`;
      if (weekdayOf(candidate) === weekday) return candidate;
    }
    return null;
  }

  let seen = 0;
  for (let day = 1; day <= total; day += 1) {
    const candidate = `${year}-${pad2(month)}-${pad2(day)}`;
    if (weekdayOf(candidate) === weekday) {
      seen += 1;
      if (seen === pos) return candidate;
    }
  }
  return null;
}

function monthlyDates(def: RecurrenceDefinition, monthFirstDay: DateOnly): DateOnly[] {
  if (def.byMonthDay != null) {
    const total = daysInMonth(monthFirstDay);
    if (def.byMonthDay > total) return [];
    return [`${yearOf(monthFirstDay)}-${pad2(monthOf(monthFirstDay))}-${pad2(def.byMonthDay)}`];
  }
  if (def.bySetPos != null && def.byWeekdayForSetPos != null) {
    const date = nthWeekdayOfMonth(monthFirstDay, def.byWeekdayForSetPos, def.bySetPos);
    return date ? [date] : [];
  }
  // Fall back to the day-of-month of the start date.
  const total = daysInMonth(monthFirstDay);
  const desired = dayOfMonth(def.startDate);
  if (desired > total) return [];
  return [`${yearOf(monthFirstDay)}-${pad2(monthOf(monthFirstDay))}-${pad2(desired)}`];
}

function yearlyDate(def: RecurrenceDefinition, year: number): DateOnly | null {
  const month = def.byMonth ?? monthOf(def.startDate);
  const monthFirst = monthStart(year, month);
  if (def.bySetPos != null && def.byWeekdayForSetPos != null) {
    return nthWeekdayOfMonth(monthFirst, def.byWeekdayForSetPos, def.bySetPos);
  }
  const total = daysInMonth(monthFirst);
  const day = def.byMonthDay ?? dayOfMonth(def.startDate);
  if (day > total) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Yields every scheduled candidate (before exclusions), ascending, bounded. */
function* candidateIterator(def: RecurrenceDefinition): Generator<DateOnly> {
  const interval = Math.max(1, Math.floor(def.interval) || 1);
  const hardEnd = def.endDate ?? "9999-12-31";
  let emitted = 0;

  const canEmit = (date: DateOnly): boolean => {
    if (compareDateOnly(date, hardEnd) > 0) return false;
    if (def.count != null && emitted >= def.count) return false;
    return true;
  };

  if (def.frequency === "DAILY") {
    let cursor = def.startDate;
    while (comparisonGuard(emitted) && canEmit(cursor)) {
      yield cursor;
      emitted += 1;
      cursor = addDays(cursor, interval);
    }
    return;
  }

  if (def.frequency === "WEEKLY") {
    const weekdays = (
      def.byWeekday.length > 0 ? [...def.byWeekday] : [weekdayOf(def.startDate)]
    ).sort((a, b) => a - b);
    // Anchor to the Monday-based week so interval weeks are stable.
    const anchorWeek = startOfWeek(def.startDate, 1);
    let week = anchorWeek;
    while (emitted < MAX_SAFETY) {
      if (compareDateOnly(week, hardEnd) > 0) break;
      let emittedThisWeek = false;
      for (const wd of weekdays) {
        const date = addDays(week, (wd - 1 + 7) % 7);
        if (compareDateOnly(date, def.startDate) < 0) continue;
        if (!canEmit(date)) break;
        yield date;
        emitted += 1;
        emittedThisWeek = true;
      }
      if (emittedThisWeek && def.count != null && emitted >= def.count) break;
      week = addWeeks(week, interval);
    }
    return;
  }

  if (def.frequency === "MONTHLY") {
    let month = startOfMonth(def.startDate);
    while (emitted < MAX_SAFETY && compareDateOnly(month, hardEnd) <= 0) {
      for (const date of monthlyDates(def, month)) {
        if (compareDateOnly(date, def.startDate) < 0) continue;
        if (!canEmit(date)) break;
        yield date;
        emitted += 1;
      }
      if (def.count != null && emitted >= def.count) break;
      month = addMonths(month, interval);
    }
    return;
  }

  // YEARLY
  let year = yearOf(def.startDate);
  while (emitted < MAX_SAFETY) {
    if (compareDateOnly(monthStart(year, 1), hardEnd) > 0) break;
    const date = yearlyDate(def, year);
    if (date && compareDateOnly(date, def.startDate) >= 0) {
      if (!canEmit(date)) break;
      yield date;
      emitted += 1;
    }
    if (def.count != null && emitted >= def.count) break;
    year += interval;
  }
}

function comparisonGuard(emitted: number): boolean {
  return emitted < MAX_SAFETY;
}

/**
 * Returns occurrences within `[from, to]` (inclusive), honouring `endDate`,
 * `count` and `exclusions`. Results are ascending and de-duplicated.
 */
export function getOccurrences(
  def: RecurrenceDefinition,
  query: OccurrenceQuery = {},
): DateOnly[] {
  const from = query.from ?? def.startDate;
  const to = query.to ?? def.endDate ?? addYearsSafe(def.startDate, 2);
  const limit = query.limit ?? 5000;
  const exclusionSet = new Set(def.exclusions);
  const results: DateOnly[] = [];

  for (const candidate of candidateIterator(def)) {
    if (compareDateOnly(candidate, from) >= 0) {
      if (compareDateOnly(candidate, to) > 0) break;
      if (!exclusionSet.has(candidate)) {
        results.push(candidate);
        if (results.length >= limit) break;
      }
    }
  }
  return results;
}

function addYearsSafe(value: DateOnly, amount: number): DateOnly {
  return addMonths(value, amount * 12);
}

/** The next scheduled occurrence strictly after `after`, or null. */
export function getNextOccurrence(
  def: RecurrenceDefinition,
  after: DateOnly,
): DateOnly | null {
  const horizon = addYearsSafe(after, 5);
  const exclusionSet = new Set(def.exclusions);
  for (const candidate of candidateIterator(def)) {
    if (compareDateOnly(candidate, after) <= 0) continue;
    if (compareDateOnly(candidate, horizon) > 0) return null;
    if (!exclusionSet.has(candidate)) return candidate;
  }
  return null;
}

/** Total scheduled occurrences for a series within a bounded window. */
export function countOccurrences(
  def: RecurrenceDefinition,
  query: OccurrenceQuery = {},
): number {
  return getOccurrences(def, { ...query, limit: Number.MAX_SAFE_INTEGER }).length;
}

export interface RecurrenceValidation {
  valid: boolean;
  errors: string[];
}

export function validateRecurrence(def: RecurrenceDefinition): RecurrenceValidation {
  const errors: string[] = [];
  if (!isDateOnly(def.startDate)) errors.push("startDate must be YYYY-MM-DD");
  if (def.endDate && !isDateOnly(def.endDate)) errors.push("endDate must be YYYY-MM-DD");
  if (def.endDate && compareDateOnly(def.endDate, def.startDate) < 0) {
    errors.push("endDate cannot be before startDate");
  }
  if (!Number.isInteger(def.interval) || def.interval < 1) {
    errors.push("interval must be a positive integer");
  }
  if (def.count != null && (!Number.isInteger(def.count) || def.count < 1)) {
    errors.push("count must be a positive integer");
  }
  if (def.endDate && def.count != null) {
    errors.push("Provide either an end date or a maximum count, not both");
  }
  if (def.frequency === "WEEKLY") {
    if (def.byWeekday.some((d) => d < 0 || d > 6)) {
      errors.push("byWeekday values must be 0..6");
    }
  }
  if (def.byMonthDay != null && (def.byMonthDay < 1 || def.byMonthDay > 31)) {
    errors.push("byMonthDay must be 1..31");
  }
  if (def.bySetPos != null && ![1, 2, 3, 4, -1].includes(def.bySetPos)) {
    errors.push("bySetPos must be 1..4 or -1");
  }
  if (def.byWeekdayForSetPos != null && (def.byWeekdayForSetPos < 0 || def.byWeekdayForSetPos > 6)) {
    errors.push("byWeekdayForSetPos must be 0..6");
  }
  if (def.frequency === "YEARLY" && def.byMonth != null) {
    if (def.byMonth < 1 || def.byMonth > 12) errors.push("byMonth must be 1..12");
  }
  for (const exclusion of def.exclusions) {
    if (!isDateOnly(exclusion)) errors.push(`Invalid exclusion date: ${exclusion}`);
  }
  return { valid: errors.length === 0, errors };
}

const ORDINAL = ["first", "second", "third", "fourth"] as const;

/** Human-readable summary used on task and event cards. */
export function formatRecurrence(def: RecurrenceDefinition): string {
  const interval = Math.max(1, def.interval);
  const every = interval === 1 ? "" : `${interval} `;
  const plural = interval === 1 ? "" : "s";

  switch (def.frequency) {
    case "DAILY":
      return interval === 1 ? "Every day" : `Every ${interval} days`;
    case "WEEKLY": {
      const days =
        def.byWeekday.length > 0
          ? ` on ${[...def.byWeekday]
              .sort((a, b) => a - b)
              .map((d) => weekdayName(d).slice(0, 3))
              .join(", ")}`
          : "";
      return `${interval === 1 ? "Every week" : `Every ${every}week${plural}`}${days}`;
    }
    case "MONTHLY": {
      if (def.bySetPos != null && def.byWeekdayForSetPos != null) {
        const ordinal =
          def.bySetPos === -1 ? "last" : (ORDINAL[def.bySetPos - 1] ?? "first");
        return `${interval === 1 ? "Monthly" : `Every ${every}month${plural}`} on the ${ordinal} ${weekdayName(def.byWeekdayForSetPos)}`;
      }
      const day = def.byMonthDay ?? dayOfMonth(def.startDate);
      return `${interval === 1 ? "Monthly" : `Every ${every}month${plural}`} on day ${day}`;
    }
    case "YEARLY": {
      const month = def.byMonth ?? monthOf(def.startDate);
      return interval === 1
        ? `Every year in ${monthName(month)}`
        : `Every ${interval} years in ${monthName(month)}`;
    }
  }
}

export function emptyRecurrence(startDate: DateOnly, timezone = "UTC"): RecurrenceDefinition {
  void timezone;
  return {
    frequency: "WEEKLY",
    interval: 1,
    byWeekday: [weekdayOf(startDate)],
    byMonthDay: null,
    bySetPos: null,
    byWeekdayForSetPos: null,
    byMonth: null,
    startDate,
    endDate: null,
    count: null,
    exclusions: [],
  };
}
