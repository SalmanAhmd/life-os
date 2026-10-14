import { describe, expect, it } from "vitest";

import {
  DEFAULT_POINT_RULES,
  buildHabitAward,
  buildMilestoneAward,
  buildPerfectDayAward,
  buildTaskCompletionAward,
  habitRewardKey,
  occurrenceRewardKey,
  pointsForTask,
  reversalKey,
  taskRewardKey,
} from "@/lib/rewards/rules";

describe("pointsForTask", () => {
  it("awards the base amount for normal priority", () => {
    expect(pointsForTask("MEDIUM", DEFAULT_POINT_RULES)).toBe(10);
  });

  it("adds the high-priority bonus when enabled", () => {
    expect(pointsForTask("HIGH", DEFAULT_POINT_RULES)).toBe(15);
    expect(pointsForTask("URGENT", DEFAULT_POINT_RULES)).toBe(15);
  });

  it("ignores the bonus when disabled", () => {
    const rules = { ...DEFAULT_POINT_RULES, pointsPerHighPriority: false };
    expect(pointsForTask("URGENT", rules)).toBe(10);
  });
});

describe("idempotency keys", () => {
  it("are stable and unique per entity", () => {
    expect(taskRewardKey("t1")).toBe("task:completed:t1");
    expect(occurrenceRewardKey("o1")).toBe("occurrence:completed:o1");
    expect(habitRewardKey("h1", "2026-10-14")).toBe("habit:h1:2026-10-14");
    expect(reversalKey("task:completed:t1")).toBe("reversal:task:completed:t1");
  });

  it("differ for different dates of the same habit", () => {
    expect(habitRewardKey("h1", "2026-10-14")).not.toBe(habitRewardKey("h1", "2026-10-15"));
  });
});

describe("buildTaskCompletionAward", () => {
  it("builds an award with the right reason", () => {
    const award = buildTaskCompletionAward(
      { kind: "task", taskId: "t1" },
      "URGENT",
      DEFAULT_POINT_RULES,
    );
    expect(award).toMatchObject({
      points: 15,
      reason: "HIGH_PRIORITY_TASK_COMPLETED",
      idempotencyKey: "task:completed:t1",
    });
  });

  it("returns null when points are zero", () => {
    const rules = { ...DEFAULT_POINT_RULES, pointsPerTask: 0, pointsPerHighPriority: false };
    expect(buildTaskCompletionAward({ kind: "task", taskId: "t1" }, "HIGH", rules)).toBeNull();
  });
});

describe("habit and milestone awards", () => {
  it("builds habit awards per date", () => {
    const award = buildHabitAward("h1", "2026-10-14", DEFAULT_POINT_RULES);
    expect(award?.idempotencyKey).toBe("habit:h1:2026-10-14");
  });

  it("builds milestone awards", () => {
    expect(buildMilestoneAward("m1", DEFAULT_POINT_RULES)?.points).toBe(25);
  });
});

describe("perfect day awards", () => {
  it("are disabled by default", () => {
    expect(buildPerfectDayAward("2026-10-14", DEFAULT_POINT_RULES)).toBeNull();
  });

  it("award a fixed bonus when enabled", () => {
    const rules = { ...DEFAULT_POINT_RULES, perfectDayEnabled: true };
    expect(buildPerfectDayAward("2026-10-14", rules)?.points).toBe(20);
  });
});
