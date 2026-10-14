import { describe, expect, it } from "vitest";

import {
  type RecurrenceDefinition,
  countOccurrences,
  formatRecurrence,
  getNextOccurrence,
  getOccurrences,
  nthWeekdayOfMonth,
  validateRecurrence,
} from "@/lib/recurrence";

function def(partial: Partial<RecurrenceDefinition>): RecurrenceDefinition {
  return {
    frequency: "DAILY",
    interval: 1,
    byWeekday: [],
    byMonthDay: null,
    bySetPos: null,
    byWeekdayForSetPos: null,
    byMonth: null,
    startDate: "2026-01-01",
    endDate: null,
    count: null,
    exclusions: [],
    ...partial,
  };
}

describe("DAILY recurrence", () => {
  it("generates every day", () => {
    const result = getOccurrences(def({}), { from: "2026-01-01", to: "2026-01-05" });
    expect(result).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("honours the interval", () => {
    const result = getOccurrences(def({ interval: 3 }), { from: "2026-01-01", to: "2026-01-10" });
    expect(result).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);
  });

  it("stops at endDate", () => {
    const result = getOccurrences(def({ endDate: "2026-01-03" }), {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(result).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("respects count (exclusions still consume count)", () => {
    const d = def({ count: 3, exclusions: ["2026-01-02"] });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-01-31" })).toEqual([
      "2026-01-01",
      "2026-01-03",
    ]);
    // Querying a later window still knows the count was consumed.
    expect(getOccurrences(d, { from: "2026-01-02", to: "2026-01-31" })).toEqual(["2026-01-03"]);
  });
});

describe("WEEKLY recurrence", () => {
  it("generates on selected weekdays", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [1, 3] });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-01-14" })).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-12",
      "2026-01-14",
    ]);
  });

  it("supports multi-week intervals", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [1, 3], interval: 2 });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-02-01" })).toEqual([
      "2026-01-12",
      "2026-01-14",
      "2026-01-26",
      "2026-01-28",
    ]);
  });

  it("defaults to the start date weekday when none supplied", () => {
    // 2026-01-01 is a Thursday.
    const d = def({ frequency: "WEEKLY" });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-01-22" })).toEqual([
      "2026-01-01",
      "2026-01-08",
      "2026-01-15",
      "2026-01-22",
    ]);
  });
});

describe("MONTHLY recurrence", () => {
  it("skips months lacking the chosen day (no clamping)", () => {
    const d = def({ frequency: "MONTHLY", startDate: "2026-01-31", byMonthDay: 31 });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-06-30" })).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
    ]);
  });

  it("supports the nth weekday of the month", () => {
    const d = def({
      frequency: "MONTHLY",
      bySetPos: 2,
      byWeekdayForSetPos: 2, // 2nd Tuesday
    });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-03-31" })).toEqual([
      "2026-01-13",
      "2026-02-10",
      "2026-03-10",
    ]);
  });

  it("supports the last weekday of the month", () => {
    const d = def({
      frequency: "MONTHLY",
      bySetPos: -1,
      byWeekdayForSetPos: 5, // last Friday
    });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-02-28" })).toEqual([
      "2026-01-30",
      "2026-02-27",
    ]);
  });

  it("returns null for an impossible position", () => {
    // There is no 5th Sunday in February 2026.
    expect(nthWeekdayOfMonth("2026-02-01", 0, 5)).toBeNull();
  });
});

describe("YEARLY recurrence", () => {
  it("skips Feb 29 in non-leap years", () => {
    const d = def({
      frequency: "YEARLY",
      startDate: "2024-02-29",
      byMonth: 2,
      byMonthDay: 29,
    });
    expect(getOccurrences(d, { from: "2024-01-01", to: "2029-12-31" })).toEqual([
      "2024-02-29",
      "2028-02-29",
    ]);
  });

  it("supports a month + day each year", () => {
    const d = def({ frequency: "YEARLY", byMonth: 12, byMonthDay: 25 });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2028-12-31" })).toEqual([
      "2026-12-25",
      "2027-12-25",
      "2028-12-25",
    ]);
  });
});

describe("getNextOccurrence", () => {
  it("finds the next occurrence strictly after a date", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [1] });
    expect(getNextOccurrence(d, "2026-01-05")).toBe("2026-01-12");
    expect(getNextOccurrence(d, "2026-01-04")).toBe("2026-01-05");
  });
});

describe("countOccurrences", () => {
  it("counts within a window", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [1, 3, 5] });
    expect(countOccurrences(d, { from: "2026-01-01", to: "2026-01-31" })).toBeGreaterThan(10);
  });
});

describe("validateRecurrence", () => {
  it("accepts a valid definition", () => {
    expect(validateRecurrence(def({})).valid).toBe(true);
  });

  it("rejects endDate + count together", () => {
    const result = validateRecurrence(def({ endDate: "2026-02-01", count: 3 }));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/end date or a maximum count/i);
  });

  it("rejects invalid intervals and positions", () => {
    expect(validateRecurrence(def({ interval: 0 })).valid).toBe(false);
    expect(validateRecurrence(def({ bySetPos: 9 })).valid).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    expect(validateRecurrence(def({ endDate: "2025-12-01" })).valid).toBe(false);
  });
});

describe("formatRecurrence", () => {
  it("describes common rules in plain language", () => {
    expect(formatRecurrence(def({ frequency: "DAILY" }))).toBe("Every day");
    expect(formatRecurrence(def({ frequency: "DAILY", interval: 2 }))).toBe("Every 2 days");
    expect(formatRecurrence(def({ frequency: "WEEKLY", byWeekday: [1, 3] }))).toContain("Mon");
    expect(formatRecurrence(def({ frequency: "MONTHLY", byMonthDay: 15 }))).toContain("15");
    expect(formatRecurrence(def({ frequency: "YEARLY", byMonth: 6 }))).toContain("June");
  });
});
