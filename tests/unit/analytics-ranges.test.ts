import { describe, expect, it } from "vitest";

import { resolveRange } from "@/lib/analytics/ranges";

const TODAY = "2026-10-14"; // Wednesday

describe("resolveRange", () => {
  it("computes last-7-days inclusive of today", () => {
    const range = resolveRange("last7", TODAY);
    expect(range.from).toBe("2026-10-08");
    expect(range.to).toBe("2026-10-14");
    expect(range.previous).toEqual({ from: "2026-10-01", to: "2026-10-07" });
  });

  it("computes last-30-days", () => {
    const range = resolveRange("last30", TODAY);
    expect(range.from).toBe("2026-09-15");
    expect(range.to).toBe("2026-10-14");
  });

  it("computes this month", () => {
    const range = resolveRange("thisMonth", TODAY);
    expect(range.from).toBe("2026-10-01");
    expect(range.to).toBe("2026-10-31");
  });

  it("computes last month across a year boundary", () => {
    const range = resolveRange("lastMonth", "2026-01-15");
    expect(range.from).toBe("2025-12-01");
    expect(range.to).toBe("2025-12-31");
  });

  it("computes this week for a Monday start", () => {
    const range = resolveRange("thisWeek", TODAY, { weekStartsOn: 1 });
    expect(range.from).toBe("2026-10-12");
    expect(range.to).toBe("2026-10-18");
  });

  it("computes this week for a Sunday start", () => {
    const range = resolveRange("thisWeek", TODAY, { weekStartsOn: 0 });
    expect(range.from).toBe("2026-10-11");
    expect(range.to).toBe("2026-10-17");
  });

  it("computes this year", () => {
    const range = resolveRange("thisYear", TODAY);
    expect(range.from).toBe("2026-01-01");
    expect(range.to).toBe("2026-12-31");
  });

  it("passes through custom ranges", () => {
    const range = resolveRange("custom", TODAY, {
      custom: { from: "2026-03-01", to: "2026-03-31" },
    });
    expect(range.from).toBe("2026-03-01");
    expect(range.to).toBe("2026-03-31");
    expect(range.previous.to).toBe("2026-02-28");
  });
});
