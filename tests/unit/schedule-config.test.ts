import { describe, expect, it } from "vitest";

import { toScheduleConfig, type ScheduleSettingsRow } from "@/features/settings/schedule-config";
import { effectiveWorkingWeekdays } from "@/lib/working-days";

function row(overrides: Partial<ScheduleSettingsRow> = {}): ScheduleSettingsRow {
  return {
    saturdayRule: "ALL_OFF",
    workingDays: [1, 2, 3, 4, 5],
    alternateSaturdayWeeks: 2,
    alternateSaturdayAnchor: null,
    dayStartMinutes: 480,
    dayEndMinutes: 1080,
    holidays: [],
    exceptionalWorkdays: [],
    ...overrides,
  };
}

describe("toScheduleConfig", () => {
  it("converts the @db.Date anchor from a Date to a DateOnly string", () => {
    const cfg = toScheduleConfig(row({ alternateSaturdayAnchor: new Date(Date.UTC(2024, 9, 1)) }));
    expect(cfg.alternateSaturdayAnchor).toBe("2024-10-01");
  });

  it("keeps a null anchor as null", () => {
    expect(toScheduleConfig(row()).alternateSaturdayAnchor).toBeNull();
  });

  it("passes scalar fields through unchanged", () => {
    const cfg = toScheduleConfig(
      row({ saturdayRule: "ALTERNATE_OFF", workingDays: [1, 3, 5], dayStartMinutes: 540 }),
    );
    expect(cfg.saturdayRule).toBe("ALTERNATE_OFF");
    expect(cfg.workingDays).toEqual([1, 3, 5]);
    expect(cfg.dayStartMinutes).toBe(540);
  });

  it("keeps an already-parsed JSON column (Prisma returns Json as JS data) intact", () => {
    const holidays = [{ date: "2024-01-01", name: "New Year's Day" }];
    expect(toScheduleConfig(row({ holidays })).holidays).toEqual(holidays);
  });

  it("parses a JSON string value", () => {
    expect(
      toScheduleConfig(row({ exceptionalWorkdays: '["2026-11-07"]' })).exceptionalWorkdays,
    ).toEqual(["2026-11-07"]);
  });

  it("falls back to an empty array for malformed or absent JSON", () => {
    const cfg = toScheduleConfig(row({ holidays: "{not json", exceptionalWorkdays: null }));
    expect(cfg.holidays).toEqual([]);
    expect(cfg.exceptionalWorkdays).toEqual([]);
  });

  // Regression: the schedule form passes the mapped config straight into
  // effectiveWorkingWeekdays. When the anchor stayed a Date (instead of a
  // DateOnly string) and the rule was ALTERNATE_OFF, that call threw
  // "Invalid DateOnly value".
  it("yields a config effectiveWorkingWeekdays can consume for ALTERNATE_OFF", () => {
    const cfg = toScheduleConfig(
      row({
        saturdayRule: "ALTERNATE_OFF",
        alternateSaturdayAnchor: new Date(Date.UTC(2026, 0, 3)), // 2026-01-03
      }),
    );
    expect(() => effectiveWorkingWeekdays("2026-10-05", 1, cfg)).not.toThrow();
    // Anchor parity makes Sat 2026-10-10 a working Saturday.
    expect(effectiveWorkingWeekdays("2026-10-05", 1, cfg)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
