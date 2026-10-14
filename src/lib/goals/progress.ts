import { clamp } from "@/lib/utils";

/**
 * Goal progress rules (single documented source of truth).
 *
 * The `metricType` decides how progress is derived:
 * - MANUAL / NUMERIC: `currentValue / targetValue` when a target is set.
 * - TASK_BASED: completed linked tasks / total linked tasks. A task can link to
 *   a goal at most once (unique constraint), so a task is never counted twice.
 *   Tasks may legitimately link to several *different* goals; this function only
 *   considers the tasks linked to this goal.
 * - HABIT_BASED: reserved for a future habit link; today it behaves like NUMERIC.
 *
 * Fallbacks keep goals usable before they have linked work:
 * - No tasks → milestones completed / total milestones.
 * - No tasks or milestones → average of sub-goal progress (hierarchy).
 * - Nothing at all → 0 unless the goal is marked completed (→ 100).
 */

export type GoalMetricType = "MANUAL" | "TASK_BASED" | "HABIT_BASED" | "NUMERIC";

export interface GoalProgressInput {
  metricType: GoalMetricType;
  status: string;
  targetValue: number | null;
  currentValue: number | null;
  linkedTasks: { status: string }[];
  milestones: { completed: boolean }[];
  subGoals: { progress: number }[];
}

export interface GoalProgressResult {
  percent: number;
  method: "completed" | "value" | "tasks" | "milestones" | "subgoals" | "empty";
}

export function computeGoalProgress(input: GoalProgressInput): GoalProgressResult {
  if (input.status === "COMPLETED" || input.status === "ARCHIVED") {
    return { percent: input.status === "COMPLETED" ? 100 : 0, method: "completed" };
  }

  if (input.metricType === "TASK_BASED" && input.linkedTasks.length > 0) {
    const done = input.linkedTasks.filter(
      (task) => task.status === "COMPLETED",
    ).length;
    return {
      percent: Math.round((done / input.linkedTasks.length) * 100),
      method: "tasks",
    };
  }

  if (
    (input.metricType === "NUMERIC" || input.metricType === "MANUAL" || input.metricType === "HABIT_BASED") &&
    input.targetValue != null &&
    input.targetValue > 0
  ) {
    const current = input.currentValue ?? 0;
    return {
      percent: clamp(Math.round((current / input.targetValue) * 100), 0, 100),
      method: "value",
    };
  }

  if (input.milestones.length > 0) {
    const done = input.milestones.filter((m) => m.completed).length;
    return {
      percent: Math.round((done / input.milestones.length) * 100),
      method: "milestones",
    };
  }

  if (input.subGoals.length > 0) {
    const average =
      input.subGoals.reduce((acc, g) => acc + g.progress, 0) / input.subGoals.length;
    return { percent: Math.round(average), method: "subgoals" };
  }

  return { percent: 0, method: "empty" };
}
