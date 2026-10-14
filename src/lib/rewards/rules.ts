import type { DateOnly } from "@/lib/dates";

/**
 * Reward point rules.
 *
 * Points are awarded through an append-only ledger (`RewardTransaction`) that
 * has a unique `idempotencyKey`. This module owns the two things that must
 * stay consistent between the UI and the server actions:
 *   1. how many points a given event is worth, and
 *   2. the idempotency key that guarantees at-most-once awarding.
 */

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PointRules {
  pointsPerTask: number;
  pointsPerHighPriority: boolean;
  highPriorityBonus: number;
  pointsPerHabit: number;
  pointsPerMilestone: number;
  perfectDayBonus: number;
  perfectDayEnabled: boolean;
}

export const DEFAULT_POINT_RULES: PointRules = {
  pointsPerTask: 10,
  pointsPerHighPriority: true,
  highPriorityBonus: 5,
  pointsPerHabit: 5,
  pointsPerMilestone: 25,
  perfectDayBonus: 20,
  perfectDayEnabled: false,
};

export type RewardReason =
  | "TASK_COMPLETED"
  | "HIGH_PRIORITY_TASK_COMPLETED"
  | "HABIT_COMPLETED"
  | "GOAL_MILESTONE_COMPLETED"
  | "PERFECT_DAY"
  | "MANUAL_ADJUSTMENT"
  | "REVERSAL";

export interface RewardAward {
  points: number;
  reason: RewardReason;
  idempotencyKey: string;
}

export function isHighPriority(priority: TaskPriority): boolean {
  return priority === "HIGH" || priority === "URGENT";
}

export function pointsForTask(priority: TaskPriority, rules: PointRules): RewardAward["points"] {
  const base = Math.max(0, rules.pointsPerTask);
  if (rules.pointsPerHighPriority && isHighPriority(priority)) {
    return base + Math.max(0, rules.highPriorityBonus);
  }
  return base;
}

export function taskCompletionReason(priority: TaskPriority, rules: PointRules): RewardReason {
  return rules.pointsPerHighPriority && isHighPriority(priority)
    ? "HIGH_PRIORITY_TASK_COMPLETED"
    : "TASK_COMPLETED";
}

// --- Idempotency key builders --------------------------------------------

export function taskRewardKey(taskId: string): string {
  return `task:completed:${taskId}`;
}

export function occurrenceRewardKey(occurrenceId: string): string {
  return `occurrence:completed:${occurrenceId}`;
}

export function habitRewardKey(habitId: string, date: DateOnly): string {
  return `habit:${habitId}:${date}`;
}

export function milestoneRewardKey(milestoneId: string): string {
  return `milestone:${milestoneId}`;
}

export function perfectDayRewardKey(date: DateOnly): string {
  return `perfectday:${date}`;
}

export function reversalKey(originalKey: string): string {
  return `reversal:${originalKey}`;
}

/**
 * Decides the award for completing a task/occurrence. Returns null when the
 * completion is worth zero points (avoids empty ledger rows).
 */
export function buildTaskCompletionAward(
  target: { kind: "task"; taskId: string } | { kind: "occurrence"; occurrenceId: string },
  priority: TaskPriority,
  rules: PointRules,
): RewardAward | null {
  const points = pointsForTask(priority, rules);
  if (points <= 0) return null;
  return {
    points,
    reason: taskCompletionReason(priority, rules),
    idempotencyKey:
      target.kind === "task"
        ? taskRewardKey(target.taskId)
        : occurrenceRewardKey(target.occurrenceId),
  };
}

export function buildHabitAward(
  habitId: string,
  date: DateOnly,
  rules: PointRules,
): RewardAward | null {
  if (rules.pointsPerHabit <= 0) return null;
  return {
    points: rules.pointsPerHabit,
    reason: "HABIT_COMPLETED",
    idempotencyKey: habitRewardKey(habitId, date),
  };
}

export function buildMilestoneAward(milestoneId: string, rules: PointRules): RewardAward | null {
  if (rules.pointsPerMilestone <= 0) return null;
  return {
    points: rules.pointsPerMilestone,
    reason: "GOAL_MILESTONE_COMPLETED",
    idempotencyKey: milestoneRewardKey(milestoneId),
  };
}

export function buildPerfectDayAward(date: DateOnly, rules: PointRules): RewardAward | null {
  if (!rules.perfectDayEnabled || rules.perfectDayBonus <= 0) return null;
  return {
    points: rules.perfectDayBonus,
    reason: "PERFECT_DAY",
    idempotencyKey: perfectDayRewardKey(date),
  };
}
