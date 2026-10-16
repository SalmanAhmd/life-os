import { describe, expect, it } from "vitest";

import {
  type HabitDefinition,
  completionRate,
  computeStreaks,
  isCompletedOn,
  isScheduledOn,
} from "@/lib/habits";

function habit(partial: Partial<HabitDefinition>): HabitDefinition {
  return { frequency: "DAILY", weekdays: [], targetPerPeriod: 1, createdAt: "2026-01-05", ...partial };
}

describe("isScheduledOn", () => {
  it("treats DAILY habits as always scheduled", () => {
    expect(isScheduledOn(habit({}), "2026-01-07")).toBe(true);
  });

  it("respects CUSTOM weekdays", () => {
    const h = habit({ frequency: "CUSTOM", weekdays: [1, 3, 5] });
    expect(isScheduledOn(h, "2026-01-05")).toBe(true); // Monday
    expect(isScheduledOn(h, "2026-01-06")).toBe(false); // Tuesday
  });
});

describe("daily streaks", () => {
  it("counts consecutive completed days", () => {
    const h = habit({});
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-06", value: 1 },
      { date: "2026-01-07", value: 1 },
    ];
    const { current, best } = computeStreaks(h, checkIns, "2026-01-07");
    expect(current).toBe(3);
    expect(best).toBe(3);
  });

  it("grants grace for an incomplete today", () => {
    const h = habit({});
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-06", value: 1 },
    ];
    const { current } = computeStreaks(h, checkIns, "2026-01-07");
    expect(current).toBe(2);
  });

  it("breaks the streak after a missed scheduled day", () => {
    const h = habit({});
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      // missed 01-06
      { date: "2026-01-07", value: 1 },
    ];
    const { current, best } = computeStreaks(h, checkIns, "2026-01-07");
    expect(current).toBe(1);
    expect(best).toBe(1);
  });

  it("ignores non-scheduled days for CUSTOM habits", () => {
    const h = habit({ frequency: "CUSTOM", weekdays: [1, 3] }); // Mon, Wed
    const checkIns = [
      { date: "2026-01-05", value: 1 }, // Mon
      { date: "2026-01-07", value: 1 }, // Wed
      { date: "2026-01-12", value: 1 }, // Mon
    ];
    const { current, best } = computeStreaks(h, checkIns, "2026-01-12");
    expect(current).toBe(3);
    expect(best).toBe(3);
  });

  it("supports quantity targets", () => {
    const h = habit({ targetPerPeriod: 8 });
    const checkIns = [
      { date: "2026-01-05", value: 8 },
      { date: "2026-01-06", value: 5 }, // partial → not complete
    ];
    // Today (01-06) gets a grace window, so the partial day does not count as
    // completed and the streak restarts at 0.
    const { current } = computeStreaks(h, checkIns, "2026-01-07");
    expect(current).toBe(0);
  });
});

describe("weekly streaks", () => {
  it("counts consecutive weeks meeting the weekly target", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 3, createdAt: "2026-01-05" });
    const checkIns = [
      // Week of Jan 5 (Mon-Sun): 3 completions
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-07", value: 1 },
      { date: "2026-01-09", value: 1 },
      // Week of Jan 12: 3 completions
      { date: "2026-01-12", value: 1 },
      { date: "2026-01-13", value: 1 },
      { date: "2026-01-15", value: 1 },
    ];
    const { current, best, unit } = computeStreaks(h, checkIns, "2026-01-18", 1);
    expect(unit).toBe("week");
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it("grants grace for an in-progress week", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 2, createdAt: "2026-01-05" });
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-06", value: 1 },
      // Current week (Jan 12) not yet met.
      { date: "2026-01-13", value: 1 },
    ];
    const { current } = computeStreaks(h, checkIns, "2026-01-14", 1);
    expect(current).toBe(1);
  });
});

describe("completionRate", () => {
  it("computes a rate over scheduled days up to yesterday", () => {
    const h = habit({});
    const checkIns = [
      { date: "2026-01-01", value: 1 },
      { date: "2026-01-02", value: 1 },
      // miss 01-03
      { date: "2026-01-04", value: 1 },
    ];
    // From 01-01 to 01-04, today is 01-04 → denominator excludes today → 2/3 → 67%
    const rate = completionRate(h, checkIns, "2026-01-01", "2026-01-04", "2026-01-04");
    expect(rate).toBe(67);
  });

  it("returns 0 when there is no elapsed period", () => {
    const h = habit({});
    expect(completionRate(h, [], "2026-01-04", "2026-01-04", "2026-01-04")).toBe(0);
  });
});

describe("isCompletedOn", () => {
  it("reports daily completion against the target", () => {
    const h = habit({ targetPerPeriod: 2 });
    expect(isCompletedOn(h, [{ date: "2026-01-05", value: 2 }], "2026-01-05")).toBe(true);
    expect(isCompletedOn(h, [{ date: "2026-01-05", value: 1 }], "2026-01-05")).toBe(false);
  });

  it("returns false when there are no check-ins", () => {
    const h = habit({});
    expect(isCompletedOn(h, [], "2026-01-05")).toBe(false);
  });

  it("aggregates multiple check-ins on the same day", () => {
    const h = habit({ targetPerPeriod: 3 });
    expect(
      isCompletedOn(h, [{ date: "2026-01-05", value: 1 }, { date: "2026-01-05", value: 2 }], "2026-01-05"),
    ).toBe(true);
  });

  it("checks weekly completion for WEEKLY habits", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 3 });
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-06", value: 1 },
      { date: "2026-01-07", value: 1 },
    ];
    expect(isCompletedOn(h, checkIns, "2026-01-07")).toBe(true);
    expect(isCompletedOn(h, checkIns, "2026-01-08")).toBe(true);
  });
});

describe("isScheduledOn additional branches", () => {
  it("treats WEEKLY habits as always scheduled", () => {
    const h = habit({ frequency: "WEEKLY" });
    expect(isScheduledOn(h, "2026-01-05")).toBe(true);
    expect(isScheduledOn(h, "2026-01-06")).toBe(true);
  });

  it("treats CUSTOM with empty weekdays as always scheduled", () => {
    const h = habit({ frequency: "CUSTOM", weekdays: [] });
    expect(isScheduledOn(h, "2026-01-05")).toBe(true);
    expect(isScheduledOn(h, "2026-01-06")).toBe(true);
  });
});

describe("computeStreaks edge cases", () => {
  it("returns zero streaks when there are no check-ins", () => {
    const h = habit({});
    const { current, best } = computeStreaks(h, [], "2026-01-07");
    expect(current).toBe(0);
    expect(best).toBe(0);
  });

  it("handles a single check-in", () => {
    const h = habit({});
    const { current, best } = computeStreaks(h, [{ date: "2026-01-05", value: 1 }], "2026-01-05");
    expect(current).toBe(1);
    expect(best).toBe(1);
  });

  it("WEEKLY returns zero when no check-ins exist", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 3 });
    const { current, best, unit } = computeStreaks(h, [], "2026-01-18");
    expect(current).toBe(0);
    expect(best).toBe(0);
    expect(unit).toBe("week");
  });

  it("tracks best streak across multiple runs", () => {
    const h = habit({});
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-06", value: 1 },
      { date: "2026-01-07", value: 1 },
      // miss 01-08
      { date: "2026-01-09", value: 1 },
      { date: "2026-01-10", value: 1 },
    ];
    const { current, best } = computeStreaks(h, checkIns, "2026-01-10");
    expect(current).toBe(2);
    expect(best).toBe(3);
  });
});

describe("completionRate additional branches", () => {
  it("computes rate for WEEKLY habits", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 3 });
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-07", value: 1 },
      { date: "2026-01-09", value: 1 },
      { date: "2026-01-12", value: 1 },
      { date: "2026-01-13", value: 1 },
    ];
    // From Jan 5 to Jan 16, today is Jan 14 → first week complete (3/3), second week in progress (skipped)
    const rate = completionRate(h, checkIns, "2026-01-05", "2026-01-16", "2026-01-14");
    expect(rate).toBe(100);
  });

  it("returns partial rate when only some weeks are complete", () => {
    const h = habit({ frequency: "WEEKLY", targetPerPeriod: 3 });
    const checkIns = [
      { date: "2026-01-05", value: 1 },
      { date: "2026-01-07", value: 1 },
      { date: "2026-01-09", value: 1 },
      // Week of Jan 12 has only 2 completions — not enough
      { date: "2026-01-12", value: 1 },
      { date: "2026-01-13", value: 1 },
    ];
    // From Jan 1 to Jan 18, today is Jan 14 → 2 elapsed weeks, 1 complete → 50%
    const rate = completionRate(h, checkIns, "2026-01-01", "2026-01-18", "2026-01-14");
    expect(rate).toBe(50);
  });

  it("returns 0 for CUSTOM habit with no elapsed days", () => {
    const h = habit({ frequency: "CUSTOM", weekdays: [1] });
    expect(completionRate(h, [], "2026-01-05", "2026-01-05", "2026-01-05")).toBe(0);
  });

  it("handles CUSTOM habit with partial completion", () => {
    const h = habit({ frequency: "CUSTOM", weekdays: [1, 3] });
    const checkIns = [
      { date: "2026-01-05", value: 1 }, // Mon - complete
      // Wed Jan 7 - missed
      { date: "2026-01-12", value: 1 }, // Mon - complete
    ];
    // From Jan 5 to Jan 14, today is Jan 14 → 3 scheduled days (Mon 5, Wed 7, Mon 12), 2 completed
    const rate = completionRate(h, checkIns, "2026-01-05", "2026-01-14", "2026-01-14");
    expect(rate).toBe(67);
  });
});
