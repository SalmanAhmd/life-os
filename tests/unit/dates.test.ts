import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  dateOnlyToDb,
  dbDateToDateOnly,
  diffDays,
  eachDay,
  formatMinutes,
  formatDateOnly,
  isDateOnly,
  parseTimeToMinutes,
  relativeDayLabel,
  setPosOfDate,
  startOfWeek,
  weekdayOf,
  zonedDateTimeToUtc,
  localDateOnly,
  daysInMonth,
} from "@/lib/dates";

describe("date-only validation and conversion", () => {
  it("accepts valid ISO dates", () => {
    expect(isDateOnly("2026-10-14")).toBe(true);
    expect(isDateOnly("2024-02-29")).toBe(true);
  });

  it("rejects invalid or malformed dates", () => {
    expect(isDateOnly("2026-2-4")).toBe(false);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("2025-02-29")).toBe(false);
    expect(isDateOnly("nonsense")).toBe(false);
  });

  it("round-trips through the database representation without tz drift", () => {
    const value = "2026-03-08";
    const db = dateOnlyToDb(value);
    expect(db.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(dbDateToDateOnly(db)).toBe(value);
  });
});

describe("date arithmetic", () => {
  it("adds days across a DST boundary safely (UTC-based)", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("adds weeks", () => {
    expect(addWeeks("2026-01-01", 2)).toBe("2026-01-15");
  });

  it("clamps month addition to the last valid day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("clamps leap-day yearly addition", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });

  it("computes differences", () => {
    expect(diffDays("2026-01-01", "2026-01-31")).toBe(30);
    expect(diffDays("2026-01-31", "2026-01-01")).toBe(-30);
  });

  it("enumerates inclusive ranges", () => {
    expect(eachDay("2026-01-01", "2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    expect(eachDay("2026-01-03", "2026-01-01")).toEqual([]);
  });
});

describe("weekday and position helpers", () => {
  it("returns weekday numbers", () => {
    expect(weekdayOf("2026-10-14")).toBe(3); // Wednesday
    expect(weekdayOf("2026-10-18")).toBe(0); // Sunday
  });

  it("computes start of week for configurable week starts", () => {
    expect(startOfWeek("2026-10-14", 1)).toBe("2026-10-12"); // Monday
    expect(startOfWeek("2026-10-14", 0)).toBe("2026-10-11"); // Sunday
  });

  it("computes nth-weekday position", () => {
    expect(setPosOfDate("2026-10-14")).toBe(2); // 2nd Wednesday
    expect(setPosOfDate("2026-10-28")).toBe(-1); // last Wednesday
  });

  it("counts days in month", () => {
    expect(daysInMonth("2024-02-01")).toBe(29);
    expect(daysInMonth("2026-02-01")).toBe(28);
    expect(daysInMonth("2026-04-01")).toBe(30);
  });
});

describe("time-of-day helpers", () => {
  it("parses 24h time strings", () => {
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("8:0")).toBeNull();
    expect(parseTimeToMinutes("bad")).toBeNull();
  });

  it("formats minutes in 12h and 24h", () => {
    expect(formatMinutes(480, "24h")).toBe("08:00");
    expect(formatMinutes(780, "12h")).toBe("1:00 PM");
    expect(formatMinutes(0, "12h")).toBe("12:00 AM");
    expect(formatMinutes(720, "12h")).toBe("12:00 PM");
  });
});

describe("timezone-aware instant helpers", () => {
  it("derives the local date in a timezone", () => {
    const instant = new Date("2026-10-14T02:00:00.000Z");
    expect(localDateOnly(instant, "UTC")).toBe("2026-10-14");
    expect(localDateOnly(instant, "America/New_York")).toBe("2026-10-13");
    expect(localDateOnly(instant, "Asia/Tokyo")).toBe("2026-10-14");
  });

  it("converts a local wall time to UTC", () => {
    const utc = zonedDateTimeToUtc("2026-10-14", 9 * 60, "America/New_York");
    // 09:00 EDT (UTC-4) == 13:00 UTC
    expect(utc.toISOString()).toBe("2026-10-14T13:00:00.000Z");
  });
});

describe("formatting", () => {
  it("formats date-only values without timezone drift", () => {
    expect(formatDateOnly("2026-10-14")).toBe("Wed, Oct 14");
  });

  it("produces relative labels", () => {
    expect(relativeDayLabel("2026-10-14", "2026-10-14")).toBe("Today");
    expect(relativeDayLabel("2026-10-15", "2026-10-14")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-13", "2026-10-14")).toBe("Yesterday");
  });
});
