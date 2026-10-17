import { dbDateToDateOnly, type DateOnly } from "@/lib/dates";

/**
 * Schedule settings as consumed by the UI.
 *
 * Kept in a Prisma-free module so the row → DTO mapping stays pure and
 * unit-testable without a database (see tests/unit/schedule-config.test.ts).
 */

export interface Holiday {
  date: DateOnly;
  name: string;
}

export type SaturdayRule =
  "ALL_OFF" | "ALTERNATE_OFF" | "SECOND_FOURTH_OFF" | "ALL_WORKING" | "CUSTOM";

export interface ScheduleConfig {
  saturdayRule: SaturdayRule;
  workingDays: number[];
  alternateSaturdayWeeks: number;
  alternateSaturdayAnchor: DateOnly | null;
  dayStartMinutes: number;
  dayEndMinutes: number;
  holidays: Holiday[];
  exceptionalWorkdays: DateOnly[];
}

/** The subset of the Prisma `ScheduleSettings` row this mapper reads. */
export interface ScheduleSettingsRow {
  saturdayRule: string;
  workingDays: number[];
  alternateSaturdayWeeks: number;
  alternateSaturdayAnchor: Date | null;
  dayStartMinutes: number;
  dayEndMinutes: number;
  holidays: unknown;
  exceptionalWorkdays: unknown;
}

/**
 * Reads a JSON column. Prisma returns `Json` values already parsed, but we also
 * accept a raw string (and fall back on malformed data) so the mapper is robust
 * either way. Naively `JSON.parse(String(value))` would stringify — and drop —
 * an already-parsed array.
 */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/**
 * Maps a `ScheduleSettings` row to a serializable DTO.
 *
 * `alternateSaturdayAnchor` is a `@db.Date` column, so Prisma returns a `Date`;
 * it must become a `DateOnly` string or date-only helpers downstream (e.g.
 * `effectiveWorkingWeekdays`) throw on an invalid DateOnly value.
 */
export function toScheduleConfig(row: ScheduleSettingsRow): ScheduleConfig {
  return {
    saturdayRule: row.saturdayRule as SaturdayRule,
    workingDays: row.workingDays,
    alternateSaturdayWeeks: row.alternateSaturdayWeeks,
    alternateSaturdayAnchor: row.alternateSaturdayAnchor
      ? dbDateToDateOnly(row.alternateSaturdayAnchor)
      : null,
    dayStartMinutes: row.dayStartMinutes,
    dayEndMinutes: row.dayEndMinutes,
    holidays: parseJson<Holiday[]>(row.holidays, []),
    exceptionalWorkdays: parseJson<DateOnly[]>(row.exceptionalWorkdays, []),
  };
}
