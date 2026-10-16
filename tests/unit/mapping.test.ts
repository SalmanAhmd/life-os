import { describe, expect, it } from "vitest";

import { ruleToDefinition } from "@/lib/recurrence/mapping";

describe("ruleToDefinition", () => {
  it("maps a persisted RecurrenceRule to a domain definition", () => {
    const rule = {
      id: "rule1",
      userId: "user1",
      frequency: "WEEKLY" as const,
      interval: 2,
      byWeekday: [1, 3],
      byMonthDay: null,
      bySetPos: null,
      byWeekdayForSetPos: null,
      byMonth: null,
      startDate: new Date("2026-01-05T00:00:00.000Z"),
      endDate: null,
      count: null,
      timezone: "UTC",
      exclusions: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = ruleToDefinition(rule);
    expect(result).toEqual({
      frequency: "WEEKLY",
      interval: 2,
      byWeekday: [1, 3],
      byMonthDay: null,
      bySetPos: null,
      byWeekdayForSetPos: null,
      byMonth: null,
      startDate: "2026-01-05",
      endDate: null,
      count: null,
      exclusions: [],
    });
  });

  it("converts endDate from Date to DateOnly", () => {
    const rule = {
      id: "rule1",
      userId: "user1",
      frequency: "DAILY" as const,
      interval: 1,
      byWeekday: [],
      byMonthDay: null,
      bySetPos: null,
      byWeekdayForSetPos: null,
      byMonth: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-02-01T00:00:00.000Z"),
      count: null,
      timezone: "UTC",
      exclusions: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = ruleToDefinition(rule);
    expect(result.endDate).toBe("2026-02-01");
  });

  it("handles non-array exclusions gracefully", () => {
    const rule = {
      id: "rule1",
      userId: "user1",
      frequency: "DAILY" as const,
      interval: 1,
      byWeekday: [],
      byMonthDay: null,
      bySetPos: null,
      byWeekdayForSetPos: null,
      byMonth: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      count: null,
      timezone: "UTC",
      exclusions: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = ruleToDefinition(rule);
    expect(result.exclusions).toEqual([]);
  });

  it("preserves exclusions as string array", () => {
    const rule = {
      id: "rule1",
      userId: "user1",
      frequency: "DAILY" as const,
      interval: 1,
      byWeekday: [],
      byMonthDay: null,
      bySetPos: null,
      byWeekdayForSetPos: null,
      byMonth: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: null,
      count: null,
      timezone: "UTC",
      exclusions: ["2026-01-15", "2026-01-20"],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const result = ruleToDefinition(rule);
    expect(result.exclusions).toEqual(["2026-01-15", "2026-01-20"]);
  });
});
