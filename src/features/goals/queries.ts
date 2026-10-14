import "server-only";

import { type DateOnly, dbDateToDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { computeGoalProgress } from "@/lib/goals/progress";

export interface GoalSummary {
  id: string;
  title: string;
  description: string | null;
  timeframe: string;
  status: string;
  priority: string;
  metricType: string;
  startDate: DateOnly;
  targetDate: DateOnly | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  progress: number;
  progressMethod: string;
  parentGoalId: string | null;
  lifeArea: { id: string; name: string; color: string } | null;
  project: { id: string; name: string } | null;
  milestoneCount: number;
  milestoneDoneCount: number;
  linkedTaskCount: number;
  linkedTaskDoneCount: number;
}

export interface GoalMilestone {
  id: string;
  title: string;
  dueDate: DateOnly | null;
  completed: boolean;
  order: number;
}

export interface GoalDetail extends GoalSummary {
  milestones: GoalMilestone[];
  linkedTasks: { id: string; title: string; status: string }[];
}

type GoalRow = Awaited<ReturnType<typeof fetchGoals>>[number];

async function fetchGoals(userId: string, includeArchived: boolean) {
  return db.goal.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { status: { not: "ARCHIVED" } }),
    },
    include: {
      lifeArea: { select: { id: true, name: true, color: true } },
      project: { select: { id: true, name: true } },
      milestones: { orderBy: { order: "asc" } },
      taskLinks: { select: { task: { select: { id: true, title: true, status: true } } } },
      subGoals: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

function progressMap(rows: GoalRow[]): Map<string, number> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const memo = new Map<string, number>();

  function compute(id: string): number {
    const cached = memo.get(id);
    if (cached != null) return cached;
    const row = byId.get(id);
    if (!row) return 0;

    const subGoals = row.subGoals.map((sub) => ({ progress: compute(sub.id) }));
    const linkedTasks = row.taskLinks.map((link) => ({ status: link.task.status }));
    const milestones = row.milestones.map((milestone) => ({
      completed: Boolean(milestone.completedAt),
    }));

    const result = computeGoalProgress({
      metricType: row.metricType,
      status: row.status,
      targetValue: row.targetValue,
      currentValue: row.currentValue,
      linkedTasks,
      milestones,
      subGoals,
    });
    memo.set(id, result.percent);
    return result.percent;
  }

  for (const row of rows) compute(row.id);
  return memo;
}

function toSummary(row: GoalRow, progress: number, method: string): GoalSummary {
  const linkedDone = row.taskLinks.filter((link) => link.task.status === "COMPLETED").length;
  const milestoneDone = row.milestones.filter((milestone) => Boolean(milestone.completedAt)).length;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    timeframe: row.timeframe,
    status: row.status,
    priority: row.priority,
    metricType: row.metricType,
    startDate: dbDateToDateOnly(row.startDate),
    targetDate: row.targetDate ? dbDateToDateOnly(row.targetDate) : null,
    targetValue: row.targetValue,
    currentValue: row.currentValue,
    unit: row.unit,
    progress,
    progressMethod: method,
    parentGoalId: row.parentGoalId,
    lifeArea: row.lifeArea,
    project: row.project,
    milestoneCount: row.milestones.length,
    milestoneDoneCount: milestoneDone,
    linkedTaskCount: row.taskLinks.length,
    linkedTaskDoneCount: linkedDone,
  };
}

export async function listGoals(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<GoalSummary[]> {
  const rows = await fetchGoals(userId, options.includeArchived ?? false);
  const memo = progressMap(rows);
  return rows.map((row) =>
    toSummary(row, memo.get(row.id) ?? 0, methodFor(row)),
  );
}

function methodFor(row: GoalRow): string {
  if (row.status === "COMPLETED") return "completed";
  if (row.metricType === "TASK_BASED" && row.taskLinks.length > 0) return "tasks";
  if (row.targetValue != null && row.targetValue > 0) return "value";
  if (row.milestones.length > 0) return "milestones";
  if (row.subGoals.length > 0) return "subgoals";
  return "empty";
}

export async function getGoalDetail(userId: string, goalId: string): Promise<GoalDetail | null> {
  const rows = await fetchGoals(userId, true);
  const row = rows.find((item) => item.id === goalId);
  if (!row) return null;
  const memo = progressMap(rows);
  const summary = toSummary(row, memo.get(goalId) ?? 0, methodFor(row));
  return {
    ...summary,
    milestones: row.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      dueDate: milestone.dueDate ? dbDateToDateOnly(milestone.dueDate) : null,
      completed: Boolean(milestone.completedAt),
      order: milestone.order,
    })),
    linkedTasks: row.taskLinks.map((link) => ({
      id: link.task.id,
      title: link.task.title,
      status: link.task.status,
    })),
  };
}

export async function listGoalOptions(userId: string): Promise<{ id: string; title: string }[]> {
  return db.goal.findMany({
    where: { userId, status: { notIn: ["ARCHIVED", "COMPLETED"] } },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });
}
