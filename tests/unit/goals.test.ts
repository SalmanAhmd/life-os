import { describe, expect, it } from "vitest";

import { computeGoalProgress } from "@/lib/goals/progress";

describe("computeGoalProgress", () => {
  it("returns 100 for a completed goal", () => {
    expect(
      computeGoalProgress({
        metricType: "NUMERIC",
        status: "COMPLETED",
        targetValue: 100,
        currentValue: 10,
        linkedTasks: [],
        milestones: [],
        subGoals: [],
      }).percent,
    ).toBe(100);
  });

  it("computes value-based progress and clamps at 100", () => {
    const result = computeGoalProgress({
      metricType: "NUMERIC",
      status: "IN_PROGRESS",
      targetValue: 12,
      currentValue: 15,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(100);
    expect(result.method).toBe("value");
  });

  it("computes task-based progress from linked tasks", () => {
    const result = computeGoalProgress({
      metricType: "TASK_BASED",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [
        { status: "COMPLETED" },
        { status: "COMPLETED" },
        { status: "TODO" },
        { status: "CANCELLED" },
      ],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(50);
    expect(result.method).toBe("tasks");
  });

  it("falls back to milestones when there are no tasks", () => {
    const result = computeGoalProgress({
      metricType: "TASK_BASED",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [],
      milestones: [{ completed: true }, { completed: false }, { completed: false }],
      subGoals: [],
    });
    expect(result.percent).toBe(33);
    expect(result.method).toBe("milestones");
  });

  it("falls back to average sub-goal progress for hierarchies", () => {
    const result = computeGoalProgress({
      metricType: "MANUAL",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [],
      milestones: [],
      subGoals: [{ progress: 100 }, { progress: 50 }],
    });
    expect(result.percent).toBe(75);
    expect(result.method).toBe("subgoals");
  });

  it("returns 0 for an empty goal", () => {
    expect(
      computeGoalProgress({
        metricType: "MANUAL",
        status: "NOT_STARTED",
        targetValue: null,
        currentValue: null,
        linkedTasks: [],
        milestones: [],
        subGoals: [],
      }).percent,
    ).toBe(0);
  });

  it("does not double count when the same task links to two goals", () => {
    // Each goal computes independently from its own unique links.
    const goalA = computeGoalProgress({
      metricType: "TASK_BASED",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [{ status: "COMPLETED" }, { status: "TODO" }],
      milestones: [],
      subGoals: [],
    });
    const goalB = computeGoalProgress({
      metricType: "TASK_BASED",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [{ status: "COMPLETED" }],
      milestones: [],
      subGoals: [],
    });
    // Goal A is 1/2, Goal B is 1/1 — neither sees the other's links.
    expect(goalA.percent).toBe(50);
    expect(goalB.percent).toBe(100);
  });
});

describe("computeGoalProgress — additional coverage", () => {
  it("returns 0 for an archived goal", () => {
    const result = computeGoalProgress({
      metricType: "NUMERIC",
      status: "ARCHIVED",
      targetValue: 100,
      currentValue: 50,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(0);
    expect(result.method).toBe("completed");
  });

  it("handles HABIT_BASED metric type as NUMERIC fallback", () => {
    const result = computeGoalProgress({
      metricType: "HABIT_BASED",
      status: "IN_PROGRESS",
      targetValue: 10,
      currentValue: 5,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(50);
    expect(result.method).toBe("value");
  });

  it("returns 0 when targetValue is zero or negative", () => {
    expect(
      computeGoalProgress({
        metricType: "NUMERIC",
        status: "IN_PROGRESS",
        targetValue: 0,
        currentValue: 5,
        linkedTasks: [],
        milestones: [],
        subGoals: [],
      }).percent,
    ).toBe(0);
  });

  it("handles currentValue of zero", () => {
    const result = computeGoalProgress({
      metricType: "NUMERIC",
      status: "IN_PROGRESS",
      targetValue: 100,
      currentValue: 0,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(0);
  });

  it("handles null currentValue as zero", () => {
    const result = computeGoalProgress({
      metricType: "NUMERIC",
      status: "IN_PROGRESS",
      targetValue: 100,
      currentValue: null,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.percent).toBe(0);
  });

  it("falls back to milestones for MANUAL goals without target", () => {
    const result = computeGoalProgress({
      metricType: "MANUAL",
      status: "IN_PROGRESS",
      targetValue: null,
      currentValue: null,
      linkedTasks: [],
      milestones: [{ completed: true }, { completed: true }, { completed: false }],
      subGoals: [],
    });
    expect(result.percent).toBe(67);
    expect(result.method).toBe("milestones");
  });

  it("returns empty method when nothing is available", () => {
    const result = computeGoalProgress({
      metricType: "MANUAL",
      status: "NOT_STARTED",
      targetValue: null,
      currentValue: null,
      linkedTasks: [],
      milestones: [],
      subGoals: [],
    });
    expect(result.method).toBe("empty");
    expect(result.percent).toBe(0);
  });
});
