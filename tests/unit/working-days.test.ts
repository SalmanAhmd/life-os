import { describe, expect, it } from "vitest";

import {
  type ScheduleConfig,
  effectiveWorkingWeekdays,
  getWorkingDaysInRange,
  isSaturdayWorking,
  isWorkingDay,
  nthSaturdayOfMonth,
  workingDayCountForMonth,
} from "@/lib/working-days";

function config(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    saturdayRule: "ALL_OFF",
    workingDays: [1, 2, 3, 4, 5],
    alternateSaturdayWeeks: 2,
    alternateSaturdayAnchor: "2026-01-03",
    holidays: [],
    exceptionalWorkdays: [],
    ...overrides,
  };
}

describe("nthSaturdayOfMonth", () => {
  it("identifies the nth Saturday", () => {
    // October 2026 Saturdays: 3, 10, 17, 24, 31
    expect(nthSaturdayOfMonth("2026-10-03")).toBe(1);
    expect(nthSaturdayOfMonth("2026-10-10")).toBe(2);
    expect(nthSaturdayOfMonth("2026-10-24")).toBe(4);
  });
});

describe("Saturday rules", () => {
  it("ALL_OFF never works on Saturday", () => {
    expect(isSaturdayWorking("2026-10-03", config({ saturdayRule: "ALL_OFF" }))).toBe(false);
  });

  it("ALL_WORKING always works on Saturday", () => {
    expect(isSaturdayWorking("2026-10-03", config({ saturdayRule: "ALL_WORKING" }))).toBe(true);
  });

  it("SECOND_FOURTH_OFF works the 1st/3rd/5th and rests the 2nd/4th", () => {
    const c = config({ saturdayRule: "SECOND_FOURTH_OFF" });
    expect(isSaturdayWorking("2026-10-03", c)).toBe(true); // 1st
    expect(isSaturdayWorking("2026-10-10", c)).toBe(false); // 2nd
    expect(isSaturdayWorking("2026-10-17", c)).toBe(true); // 3rd
    expect(isSaturdayWorking("2026-10-24", c)).toBe(false); // 4th
    expect(isSaturdayWorking("2026-10-31", c)).toBe(true); // 5th
  });

  it("ALTERNATE_OFF alternates from the anchor Saturday", () => {
    const c = config({ saturdayRule: "ALTERNATE_OFF", alternateSaturdayAnchor: "2026-01-03" });
    expect(isSaturdayWorking("2026-01-03", c)).toBe(true); // anchor week = working
    expect(isSaturdayWorking("2026-01-10", c)).toBe(false);
    expect(isSaturdayWorking("2026-01-17", c)).toBe(true);
    expect(isSaturdayWorking("2026-01-24", c)).toBe(false);
    // Before the anchor, parity must remain stable.
    expect(isSaturdayWorking("2025-12-27", c)).toBe(false);
    expect(isSaturdayWorking("2025-12-20", c)).toBe(true);
  });

  it("ALTERNATE_OFF with 3-week spacing", () => {
    const c = config({
      saturdayRule: "ALTERNATE_OFF",
      alternateSaturdayWeeks: 3,
      alternateSaturdayAnchor: "2026-01-03",
    });
    expect(isSaturdayWorking("2026-01-03", c)).toBe(true);
    expect(isSaturdayWorking("2026-01-10", c)).toBe(false);
    expect(isSaturdayWorking("2026-01-17", c)).toBe(false);
    expect(isSaturdayWorking("2026-01-24", c)).toBe(true);
  });

  it("CUSTOM uses the explicit working day list", () => {
    expect(
      isSaturdayWorking("2026-10-03", config({ saturdayRule: "CUSTOM", workingDays: [1, 2, 3, 4, 5, 6] })),
    ).toBe(true);
    expect(
      isSaturdayWorking("2026-10-03", config({ saturdayRule: "CUSTOM", workingDays: [1, 2, 3, 4, 5] })),
    ).toBe(false);
  });
});

describe("isWorkingDay precedence", () => {
  it("treats holidays as non-working even on working days", () => {
    const c = config({ holidays: [{ date: "2026-10-14", name: "Founders Day" }] });
    expect(isWorkingDay("2026-10-14", c)).toBe(false);
  });

  it("lets exceptional working days override holidays", () => {
    const c = config({
      holidays: [{ date: "2026-10-14", name: "Holiday" }],
      exceptionalWorkdays: ["2026-10-14"],
    });
    expect(isWorkingDay("2026-10-14", c)).toBe(true);
  });

  it("lets exceptional working days override an off Saturday", () => {
    const c = config({
      saturdayRule: "ALL_OFF",
      exceptionalWorkdays: ["2026-10-03"],
    });
    expect(isWorkingDay("2026-10-03", c)).toBe(true);
  });
});

describe("ranges and previews", () => {
  it("lists working days in a range", () => {
    const days = getWorkingDaysInRange("2026-10-12", "2026-10-18", config());
    expect(days).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });

  it("counts working days in a month", () => {
    // October 2026 has 22 weekdays (Oct 1 is Thursday).
    expect(workingDayCountForMonth(2026, 10, config())).toBe(22);
  });

  it("derives effective working weekdays from real dates", () => {
    const c = config({ saturdayRule: "SECOND_FOURTH_OFF" });
    // Week of Oct 5 2026: Sat Oct 10 is the 2nd Saturday → off.
    expect(effectiveWorkingWeekdays("2026-10-05", 1, c)).toEqual([1, 2, 3, 4, 5]);
    // Week of Oct 12 2026: Sat Oct 17 is the 3rd Saturday → working.
    expect(effectiveWorkingWeekdays("2026-10-12", 1, c)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
