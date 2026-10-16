import { describe, expect, it } from "vitest";

import {
  type RecurrenceDefinition,
  countOccurrences,
  emptyRecurrence,
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

  it("describes WEEKLY with interval > 1", () => {
    expect(formatRecurrence(def({ frequency: "WEEKLY", interval: 2 }))).toBe("Every 2 weeks");
  });

  it("describes MONTHLY with nth weekday", () => {
    const result = formatRecurrence(
      def({ frequency: "MONTHLY", bySetPos: 2, byWeekdayForSetPos: 2 }),
    );
    expect(result).toContain("second");
    expect(result).toContain("Tuesday");
  });

  it("describes MONTHLY with last weekday", () => {
    const result = formatRecurrence(
      def({ frequency: "MONTHLY", bySetPos: -1, byWeekdayForSetPos: 5 }),
    );
    expect(result).toContain("last");
    expect(result).toContain("Friday");
  });

  it("describes YEARLY with interval > 1", () => {
    expect(formatRecurrence(def({ frequency: "YEARLY", interval: 2, byMonth: 6 }))).toBe(
      "Every 2 years in June",
    );
  });
});

describe("emptyRecurrence", () => {
  it("creates a valid default recurrence", () => {
    const result = emptyRecurrence("2026-10-14");
    expect(result.frequency).toBe("WEEKLY");
    expect(result.interval).toBe(1);
    expect(result.startDate).toBe("2026-10-14");
    expect(result.byWeekday).toEqual([3]); // Wednesday
  });
});

describe("getOccurrences with limit", () => {
  it("respects the limit parameter", () => {
    const d = def({});
    const result = getOccurrences(d, { from: "2026-01-01", to: "2026-01-31", limit: 5 });
    expect(result).toHaveLength(5);
  });

  it("returns all occurrences when limit exceeds available dates", () => {
    const d = def({});
    const result = getOccurrences(d, { from: "2026-01-01", to: "2026-01-05", limit: 100 });
    expect(result).toHaveLength(5);
  });
});

describe("getNextOccurrence edge cases", () => {
  it("skips excluded dates", () => {
    const d = def({ frequency: "DAILY", exclusions: ["2026-01-02"] });
    expect(getNextOccurrence(d, "2026-01-01")).toBe("2026-01-03");
  });

  it("returns null when beyond the horizon", () => {
    const d = def({ frequency: "DAILY", endDate: "2026-01-10" });
    expect(getNextOccurrence(d, "2026-01-10")).toBeNull();
  });
});

describe("nthWeekdayOfMonth positive positions", () => {
  it("finds the first weekday of a month", () => {
    // First Monday of January 2026: Jan 5
    expect(nthWeekdayOfMonth("2026-01-01", 1, 1)).toBe("2026-01-05");
  });

  it("finds the third weekday of a month", () => {
    // Third Wednesday of January 2026: Jan 21
    expect(nthWeekdayOfMonth("2026-01-01", 3, 3)).toBe("2026-01-21");
  });
});

describe("countOccurrences exact count", () => {
  it("counts exactly within a window", () => {
    const d = def({ frequency: "DAILY" });
    expect(countOccurrences(d, { from: "2026-01-01", to: "2026-01-10" })).toBe(10);
  });

  it("counts weekly occurrences", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [1, 3, 5] });
    expect(countOccurrences(d, { from: "2026-01-01", to: "2026-01-31" })).toBe(13);
  });
});

describe("validateRecurrence additional branches", () => {
  it("rejects invalid startDate format", () => {
    expect(validateRecurrence(def({ startDate: "not-a-date" })).valid).toBe(false);
  });

  it("rejects invalid endDate format", () => {
    expect(validateRecurrence(def({ endDate: "bad" })).valid).toBe(false);
  });

  it("rejects invalid byWeekday values", () => {
    const d = def({ frequency: "WEEKLY", byWeekday: [7] });
    expect(validateRecurrence(d).valid).toBe(false);
  });

  it("rejects invalid byMonthDay values", () => {
    expect(validateRecurrence(def({ byMonthDay: 0 })).valid).toBe(false);
    expect(validateRecurrence(def({ byMonthDay: 32 })).valid).toBe(false);
  });

  it("rejects invalid byWeekdayForSetPos values", () => {
    expect(validateRecurrence(def({ byWeekdayForSetPos: 7 })).valid).toBe(false);
  });

  it("rejects invalid byMonth values", () => {
    const d = def({ frequency: "YEARLY", byMonth: 13 });
    expect(validateRecurrence(d).valid).toBe(false);
  });

  it("rejects invalid exclusion dates", () => {
    const d = def({ exclusions: ["not-a-date"] });
    expect(validateRecurrence(d).valid).toBe(false);
  });

  it("rejects non-integer interval", () => {
    expect(validateRecurrence(def({ interval: 1.5 })).valid).toBe(false);
  });

  it("rejects non-integer count", () => {
    expect(validateRecurrence(def({ count: 2.5 })).valid).toBe(false);
  });
});

describe("MONTHLY fallback to startDate day-of-month", () => {
  it("uses the day from startDate when byMonthDay and bySetPos are null", () => {
    const d = def({ frequency: "MONTHLY", startDate: "2026-01-15" });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2026-03-31" })).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });
});

describe("YEARLY with bySetPos", () => {
  it("supports nth weekday of a specific month", () => {
    const d = def({
      frequency: "YEARLY",
      startDate: "2026-01-01",
      byMonth: 6,
      bySetPos: 2,
      byWeekdayForSetPos: 2, // 2nd Tuesday of June
    });
    expect(getOccurrences(d, { from: "2026-01-01", to: "2027-12-31" })).toEqual([
      "2026-06-09",
      "2027-06-08",
    ]);
  });
});
