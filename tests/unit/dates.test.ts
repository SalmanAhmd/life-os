import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareDateOnly,
  dateOnlyToDb,
  dateOnlyToUtc,
  dbDateToDateOnly,
  dayOfMonth,
  daysInMonth,
  diffDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatDateOnly,
  formatDateOnlyLong,
  formatInstant,
  formatMinutes,
  isDateOnly,
  isWeekend,
  localDateOnly,
  maxDateOnly,
  minDateOnly,
  minutesToDurationLabel,
  monthName,
  monthOf,
  parseTimeToMinutes,
  relativeDayLabel,
  setPosOfDate,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toZoned,
  todayDateOnly,
  weekdayName,
  weekdayOf,
  weekdayShort,
  yearOf,
  zonedDateTimeToUtc,
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

  it("produces 'In N days' for near-future dates", () => {
    expect(relativeDayLabel("2026-10-18", "2026-10-14")).toBe("In 4 days");
    expect(relativeDayLabel("2026-10-21", "2026-10-14")).toBe("In 7 days");
  });

  it("produces 'N days ago' for near-past dates", () => {
    expect(relativeDayLabel("2026-10-10", "2026-10-14")).toBe("4 days ago");
    expect(relativeDayLabel("2026-10-07", "2026-10-14")).toBe("7 days ago");
  });

  it("falls back to a formatted date for distant dates", () => {
    const result = relativeDayLabel("2026-12-25", "2026-10-14");
    expect(result).toBe("Fri, Dec 25, 2026");
  });
});

describe("comparison helpers", () => {
  it("compares two DateOnly values", () => {
    expect(compareDateOnly("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareDateOnly("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareDateOnly("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("returns the minimum and maximum of two dates", () => {
    expect(minDateOnly("2026-01-01", "2026-01-02")).toBe("2026-01-01");
    expect(minDateOnly("2026-01-02", "2026-01-01")).toBe("2026-01-01");
    expect(maxDateOnly("2026-01-01", "2026-01-02")).toBe("2026-01-02");
    expect(maxDateOnly("2026-01-02", "2026-01-01")).toBe("2026-01-02");
  });
});

describe("range boundaries", () => {
  it("computes end of week", () => {
    expect(endOfWeek("2026-10-14", 1)).toBe("2026-10-18"); // Wed → Sun
    expect(endOfWeek("2026-10-14", 0)).toBe("2026-10-17"); // Wed → Sat
  });

  it("computes start and end of month", () => {
    expect(startOfMonth("2026-10-14")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-14")).toBe("2026-10-31");
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
  });

  it("computes start and end of year", () => {
    expect(startOfYear("2026-10-14")).toBe("2026-01-01");
    expect(endOfYear("2026-10-14")).toBe("2026-12-31");
  });

  it("detects weekends", () => {
    expect(isWeekend("2026-10-17")).toBe(true); // Saturday
    expect(isWeekend("2026-10-18")).toBe(true); // Sunday
    expect(isWeekend("2026-10-14")).toBe(false); // Wednesday
  });
});

describe("date part extractors", () => {
  it("extracts day, month, and year", () => {
    expect(dayOfMonth("2026-10-14")).toBe(14);
    expect(monthOf("2026-10-14")).toBe(10);
    expect(yearOf("2026-10-14")).toBe(2026);
  });
});

describe("duration label", () => {
  it("formats minutes as a human-readable duration", () => {
    expect(minutesToDurationLabel(0)).toBe("0m");
    expect(minutesToDurationLabel(30)).toBe("30m");
    expect(minutesToDurationLabel(60)).toBe("1h");
    expect(minutesToDurationLabel(90)).toBe("1h 30m");
    expect(minutesToDurationLabel(150)).toBe("2h 30m");
  });
});

describe("name helpers", () => {
  it("returns full weekday names", () => {
    expect(weekdayName(0)).toBe("Sunday");
    expect(weekdayName(1)).toBe("Monday");
    expect(weekdayName(6)).toBe("Saturday");
  });

  it("returns short weekday names", () => {
    expect(weekdayShort(0)).toBe("Sun");
    expect(weekdayShort(3)).toBe("Wed");
    expect(weekdayShort(6)).toBe("Sat");
  });

  it("returns full month names", () => {
    expect(monthName(1)).toBe("January");
    expect(monthName(6)).toBe("June");
    expect(monthName(12)).toBe("December");
  });
});

describe("formatDateOnlyLong", () => {
  it("formats with full weekday and month names", () => {
    expect(formatDateOnlyLong("2026-10-14")).toBe("Wednesday, October 14, 2026");
  });
});

describe("timezone-aware instant helpers", () => {
  it("returns today's DateOnly in a timezone", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    expect(todayDateOnly("UTC", now)).toBe("2026-10-14");
    expect(todayDateOnly("America/New_York", now)).toBe("2026-10-14");
  });

  it("formats an instant in a timezone", () => {
    const instant = new Date("2026-10-14T12:00:00.000Z");
    expect(formatInstant(instant, "UTC", "yyyy-MM-dd")).toBe("2026-10-14");
    expect(formatInstant(instant, "America/New_York", "yyyy-MM-dd")).toBe("2026-10-14");
  });

  it("converts an instant to a zoned Date", () => {
    const instant = new Date("2026-10-14T12:00:00.000Z");
    const zoned = toZoned(instant, "UTC");
    expect(zoned.getHours()).toBe(12);
  });
});

describe("dateOnlyToUtc", () => {
  it("converts a valid DateOnly to a UTC Date", () => {
    const result = dateOnlyToUtc("2026-10-14");
    expect(result.toISOString()).toBe("2026-10-14T00:00:00.000Z");
  });

  it("throws for an invalid DateOnly", () => {
    expect(() => dateOnlyToUtc("not-a-date")).toThrow();
    expect(() => dateOnlyToUtc("2026-13-01")).toThrow();
  });
});

describe("eachDay guard", () => {
  it("returns an empty array when from > to", () => {
    expect(eachDay("2026-01-05", "2026-01-01")).toEqual([]);
  });

  it("handles a single day range", () => {
    expect(eachDay("2026-01-01", "2026-01-01")).toEqual(["2026-01-01"]);
  });
});
