import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Date handling for Life OS.
 *
 * Two distinct concepts are used throughout the app:
 *
 * 1. **DateOnly** — a calendar date with no time or timezone, represented as a
 *    `YYYY-MM-DD` string. Deadlines, habit check-ins, occurrence dates and
 *    goal target dates are DateOnly. In PostgreSQL these are `date` columns
 *    and Prisma surfaces them as a `Date` at UTC midnight, so we convert with
 *    the helpers below. DateOnly values are interpreted in the *user's*
 *    timezone when a "which day is it" question is asked.
 *
 * 2. **Instants** — real points in time (event start, reminder trigger). Stored
 *    as UTC and rendered in the user's timezone.
 *
 * All arithmetic on DateOnly is done in UTC to avoid DST drift.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DateOnly = string;
export type TimeFormat = "12h" | "24h";

export function isDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

/** DateOnly string -> JS Date at UTC midnight (safe for Date.UTC arithmetic). */
export function dateOnlyToUtc(value: DateOnly): Date {
  if (!isDateOnly(value)) throw new Error(`Invalid DateOnly value: ${value}`);
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** JS Date at UTC midnight -> DateOnly string. */
export function utcToDateOnly(date: Date): DateOnly {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate() + 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Prisma `date` column value -> DateOnly. */
export function dbDateToDateOnly(date: Date): DateOnly {
  return utcToDateOnly(date);
}

/** DateOnly -> value suitable for a Prisma `date` column. */
export function dateOnlyToDb(value: DateOnly): Date {
  return dateOnlyToUtc(value);
}

export function addDays(value: DateOnly, amount: number): DateOnly {
  const date = dateOnlyToUtc(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcToDateOnly(date);
}

export function addWeeks(value: DateOnly, amount: number): DateOnly {
  return addDays(value, amount * 7);
}

/** Adds months, clamping to the last valid day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(value: DateOnly, amount: number): DateOnly {
  const date = dateOnlyToUtc(value);
  const day = date.getUTCDate();
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + amount;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return utcToDateOnly(new Date(Date.UTC(targetYear, targetMonth, clampedDay)));
}

/** Adds years, clamping Feb 29 to Feb 28 in non-leap years. */
export function addYears(value: DateOnly, amount: number): DateOnly {
  return addMonths(value, amount * 12);
}

/** Whole days between two DateOnly values (b - a). */
export function diffDays(a: DateOnly, b: DateOnly): number {
  const ms = dateOnlyToUtc(b).getTime() - dateOnlyToUtc(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDateOnly(a: DateOnly, b: DateOnly): DateOnly {
  return a <= b ? a : b;
}

export function maxDateOnly(a: DateOnly, b: DateOnly): DateOnly {
  return a >= b ? a : b;
}

/** Inclusive list of DateOnly values from `from` to `to`. */
export function eachDay(from: DateOnly, to: DateOnly): DateOnly[] {
  if (compareDateOnly(from, to) > 0) return [];
  const result: DateOnly[] = [];
  let cursor = from;
  // Guard against pathological ranges (e.g. 100 years).
  let guard = 0;
  while (compareDateOnly(cursor, to) <= 0 && guard < 40_000) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return result;
}

/** Day of week: 0 = Sunday … 6 = Saturday (UTC, matches calendar intuition). */
export function weekdayOf(value: DateOnly): number {
  return dateOnlyToUtc(value).getUTCDay();
}

export function dayOfMonth(value: DateOnly): number {
  return dateOnlyToUtc(value).getUTCDate();
}

export function monthOf(value: DateOnly): number {
  return dateOnlyToUtc(value).getUTCMonth() + 1;
}

export function yearOf(value: DateOnly): number {
  return dateOnlyToUtc(value).getUTCFullYear();
}

/** Nth occurrence of a weekday within the month. -1 means "last". */
export function setPosOfDate(value: DateOnly): number {
  const day = dayOfMonth(value);
  const total = daysInMonth(value);
  const fromEnd = Math.ceil((total - day + 1) / 7);
  if (day + 7 > total) return -1;
  return Math.ceil(day / 7) || fromEnd;
}

export function daysInMonth(value: DateOnly): number {
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Start of the week containing `value`, where weekStartsOn is 0=Sun..6=Sat. */
export function startOfWeek(value: DateOnly, weekStartsOn: number): DateOnly {
  const dow = weekdayOf(value);
  const diff = (dow - weekStartsOn + 7) % 7;
  return addDays(value, -diff);
}

export function endOfWeek(value: DateOnly, weekStartsOn: number): DateOnly {
  return addDays(startOfWeek(value, weekStartsOn), 6);
}

export function startOfMonth(value: DateOnly): DateOnly {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: DateOnly): DateOnly {
  const [y, m] = value.split("-").map(Number);
  return utcToDateOnly(new Date(Date.UTC(y, m, 0)));
}

export function startOfYear(value: DateOnly): DateOnly {
  return `${value.slice(0, 4)}-01-01`;
}

export function endOfYear(value: DateOnly): DateOnly {
  return `${value.slice(0, 4)}-12-31`;
}

export function isWeekend(value: DateOnly): boolean {
  const dow = weekdayOf(value);
  return dow === 0 || dow === 6;
}

// ---------------------------------------------------------------------------
// Time-of-day (minutes from local midnight)
// ---------------------------------------------------------------------------

/** Parses "HH:mm" (24h) into minutes from midnight. Returns null if invalid. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutes(minutes: number, format: TimeFormat = "24h"): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  if (format === "12h") {
    const period = hours < 12 ? "AM" : "PM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${String(mins).padStart(2, "0")} ${period}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function minutesToDurationLabel(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Timezone-aware helpers (instants)
// ---------------------------------------------------------------------------

/** The calendar date at `instant` in the given IANA timezone. */
export function localDateOnly(instant: Date, timezone: string): DateOnly {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

/** Today's DateOnly in the given timezone. */
export function todayDateOnly(timezone: string, now: Date = new Date()): DateOnly {
  return localDateOnly(now, timezone);
}

/** UTC instant for a local date + minutes-from-midnight in a timezone. */
export function zonedDateTimeToUtc(
  date: DateOnly,
  minutesFromMidnight: number,
  timezone: string,
): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const local = `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return fromZonedTime(local, timezone);
}

/** Formats an instant in the user's timezone. */
export function formatInstant(instant: Date, timezone: string, pattern: string): string {
  return formatInTimeZone(instant, timezone, pattern);
}

/** Wall-clock Date in the target zone (for calendar math on instants). */
export function toZoned(instant: Date, timezone: string): Date {
  return toZonedTime(instant, timezone);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[((day % 7) + 7) % 7] ?? "";
}

export function weekdayShort(day: number): string {
  return WEEKDAY_SHORT[((day % 7) + 7) % 7] ?? "";
}

export function monthName(month: number): string {
  return MONTH_NAMES[((month - 1) % 12 + 12) % 12] ?? "";
}

/** "Wed, Oct 14" — constructed without a tz so it is safe for DateOnly. */
export function formatDateOnly(value: DateOnly, opts?: { withYear?: boolean }): string {
  const date = dateOnlyToUtc(value);
  const weekday = WEEKDAY_SHORT[date.getUTCDay()];
  const month = MONTH_NAMES[date.getUTCMonth()]?.slice(0, 3);
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return opts?.withYear ? `${weekday}, ${month} ${day}, ${year}` : `${weekday}, ${month} ${day}`;
}

export function formatDateOnlyLong(value: DateOnly): string {
  const date = dateOnlyToUtc(value);
  return `${WEEKDAY_NAMES[date.getUTCDay()]}, ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function relativeDayLabel(value: DateOnly, today: DateOnly): string {
  const delta = diffDays(today, value) - 1;
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1 && delta <= 7) return `In ${delta} days`;
  if (delta < -1 && delta >= -7) return `${Math.abs(delta)} days ago`;
  return formatDateOnly(value, { withYear: true });
}
