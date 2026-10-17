import { describe, expect, it } from "vitest";

import { MOOD_SCORES, moodScore, zeroFillDays } from "@/lib/analytics/series";

describe("zeroFillDays", () => {
  it("fills missing days with zero across the range", () => {
    const result = zeroFillDays("2026-10-01", "2026-10-04", [
      { date: "2026-10-01", value: 2 },
      { date: "2026-10-04", value: 5 },
    ]);

    expect(result).toEqual([
      { date: "2026-10-01", value: 2 },
      { date: "2026-10-02", value: 0 },
      { date: "2026-10-03", value: 0 },
      { date: "2026-10-04", value: 5 },
    ]);
  });

  it("returns the whole range as zero when the data is empty", () => {
    const result = zeroFillDays("2026-10-01", "2026-10-03", []);

    expect(result).toEqual([
      { date: "2026-10-01", value: 0 },
      { date: "2026-10-02", value: 0 },
      { date: "2026-10-03", value: 0 },
    ]);
  });

  it("returns a single point for a one-day range", () => {
    expect(zeroFillDays("2026-10-01", "2026-10-01", [])).toEqual([
      { date: "2026-10-01", value: 0 },
    ]);
  });

  it("returns an empty array when the range is inverted", () => {
    expect(zeroFillDays("2026-10-05", "2026-10-01", [{ date: "2026-10-03", value: 1 }])).toEqual(
      [],
    );
  });

  it("crosses month boundaries with UTC-safe arithmetic", () => {
    const result = zeroFillDays("2026-10-30", "2026-11-02", []);

    expect(result.map((point) => point.date)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("crosses a leap-day boundary", () => {
    const result = zeroFillDays("2028-02-27", "2028-03-01", []);

    expect(result.map((point) => point.date)).toEqual([
      "2028-02-27",
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("drops points that fall outside the range", () => {
    const result = zeroFillDays("2026-10-02", "2026-10-03", [
      { date: "2026-09-30", value: 9 },
      { date: "2026-10-02", value: 1 },
      { date: "2026-10-04", value: 9 },
    ]);

    expect(result).toEqual([
      { date: "2026-10-02", value: 1 },
      { date: "2026-10-03", value: 0 },
    ]);
  });

  it("keeps an explicit zero from the input data", () => {
    const result = zeroFillDays("2026-10-01", "2026-10-02", [{ date: "2026-10-01", value: 0 }]);

    expect(result).toEqual([
      { date: "2026-10-01", value: 0 },
      { date: "2026-10-02", value: 0 },
    ]);
  });

  it("lets the last value win when a date appears more than once", () => {
    const result = zeroFillDays("2026-10-01", "2026-10-01", [
      { date: "2026-10-01", value: 3 },
      { date: "2026-10-01", value: 7 },
    ]);

    expect(result).toEqual([{ date: "2026-10-01", value: 7 }]);
  });
});

describe("moodScore", () => {
  it.each([
    ["GREAT", 5],
    ["GOOD", 4],
    ["OKAY", 3],
    ["LOW", 2],
    ["BAD", 1],
  ])("maps %s to %i", (mood, expected) => {
    expect(moodScore(mood)).toBe(expected);
  });

  it.each([null, undefined, ""])("returns null for %s", (mood) => {
    expect(moodScore(mood as string | null | undefined)).toBeNull();
  });

  it("returns null for an unrecognised mood", () => {
    expect(moodScore("ECSTATIC")).toBeNull();
  });

  it("covers every JournalMood enum value", () => {
    expect(Object.keys(MOOD_SCORES).sort()).toEqual(["BAD", "GOOD", "GREAT", "LOW", "OKAY"]);
  });
});
