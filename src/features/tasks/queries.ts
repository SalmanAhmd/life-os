import "server-only";

import type { Prisma } from "@prisma/client";

import {
  type DateOnly,
  addDays,
  compareDateOnly,
  dateOnlyToDb,
  dbDateToDateOnly,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { formatRecurrence, getOccurrences } from "@/lib/recurrence";
import { ruleToDefinition } from "@/lib/recurrence/mapping";
import type { TaskFilters, TaskItem, TaskPriority, TaskStatus } from "@/features/tasks/types";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  doDate: true,
  dueDate: true,
  startMinutes: true,
  endMinutes: true,
  estimatedMinutes: true,
  actualMinutes: true,
  completedAt: true,
  isRecurring: true,
  seriesId: true,
  parentTaskId: true,
  lifeArea: { select: { id: true, name: true, color: true } },
  project: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
  recurrenceRule: true,
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

const PRIORITY_RANK: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function timeSortKey(item: TaskItem): number {
  if (item.startMinutes != null) return item.startMinutes;
  return 24 * 60 + PRIORITY_RANK[item.priority];
}

function sortItems(items: TaskItem[]): TaskItem[] {
  return items.sort((a, b) => {
    const aDate = a.doDate ?? a.dueDate ?? "9999-12-31";
    const bDate = b.doDate ?? b.dueDate ?? "9999-12-31";
    const byDate = compareDateOnly(aDate, bDate);
    if (byDate !== 0) return byDate;
    const byTime = timeSortKey(a) - timeSortKey(b);
    if (byTime !== 0) return byTime;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Materialises recurring-task occurrences inside a bounded window. Called before
 * reading a list so occurrences exist to be completed/tracked. Idempotent via
 * the `(taskId, scheduledFor)` unique constraint.
 */
export async function ensureOccurrencesForRange(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): Promise<void> {
  if (compareDateOnly(from, to) > 0) return;

  const series = await db.task.findMany({
    where: { userId, isRecurring: true, archivedAt: null, recurrenceRuleId: { not: null } },
    select: { id: true, seriesId: true, recurrenceRule: true },
  });

  for (const item of series) {
    if (!item.recurrenceRule) continue;
    const dates = getOccurrences(ruleToDefinition(item.recurrenceRule), { from, to });
    if (dates.length === 0) continue;
    await db.taskOccurrence.createMany({
      data: dates.map((date) => ({
        userId,
        taskId: item.id,
        seriesId: item.seriesId ?? item.id,
        scheduledFor: dateOnlyToDb(date),
      })),
      skipDuplicates: true,
    });
  }
}

function mapTaskRow(task: TaskRow): TaskItem {
  return {
    id: task.id,
    taskId: task.id,
    occurrenceId: null,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    doDate: task.doDate ? dbDateToDateOnly(task.doDate) : null,
    dueDate: task.dueDate ? dbDateToDateOnly(task.dueDate) : null,
    startMinutes: task.startMinutes,
    endMinutes: task.endMinutes,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    isRecurring: task.isRecurring,
    seriesId: task.seriesId,
    recurrenceLabel: task.recurrenceRule
      ? formatRecurrence(ruleToDefinition(task.recurrenceRule))
      : null,
    parentTaskId: task.parentTaskId,
    lifeArea: task.lifeArea,
    project: task.project,
    tags: task.tags,
    subtaskCount: 0,
    subtaskCompletedCount: 0,
  };
}

function mapOccurrenceRow(
  occurrence: {
    id: string;
    seriesId: string;
    scheduledFor: Date;
    movedTo: Date | null;
    status: string;
    completedAt: Date | null;
    actualMinutes: number | null;
  },
  task: TaskRow,
): TaskItem {
  const scheduled = occurrence.movedTo ?? occurrence.scheduledFor;
  const status: TaskStatus =
    occurrence.status === "COMPLETED"
      ? "COMPLETED"
      : occurrence.status === "SKIPPED"
        ? "CANCELLED"
        : "TODO";
  return {
    id: occurrence.id,
    taskId: task.id,
    occurrenceId: occurrence.id,
    title: task.title,
    description: task.description,
    status,
    priority: task.priority as TaskPriority,
    doDate: dbDateToDateOnly(scheduled),
    dueDate: null,
    startMinutes: task.startMinutes,
    endMinutes: task.endMinutes,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: occurrence.actualMinutes ?? task.actualMinutes,
    completedAt: occurrence.completedAt ? occurrence.completedAt.toISOString() : null,
    isRecurring: true,
    seriesId: occurrence.seriesId,
    recurrenceLabel: task.recurrenceRule
      ? formatRecurrence(ruleToDefinition(task.recurrenceRule))
      : null,
    parentTaskId: null,
    lifeArea: task.lifeArea,
    project: task.project,
    tags: task.tags,
    subtaskCount: 0,
    subtaskCompletedCount: 0,
  };
}

function occurrenceWindow(
  view: NonNullable<TaskFilters["view"]>,
  filters: TaskFilters,
  today: DateOnly,
): { from: DateOnly; to: DateOnly } {
  let from: DateOnly;
  let to: DateOnly;
  switch (view) {
    case "today":
      from = today;
      to = today;
      break;
    case "upcoming":
      from = addDays(today, 1);
      to = addDays(today, 120);
      break;
    case "overdue":
      from = addDays(today, -365);
      to = addDays(today, -1);
      break;
    case "completed":
      from = addDays(today, -180);
      to = addDays(today, 30);
      break;
    default:
      from = addDays(today, -30);
      to = addDays(today, 120);
  }
  if (filters.from) from = filters.from;
  if (filters.to) to = filters.to;
  return { from, to };
}

/** Unified list of simple tasks and recurring-task occurrences. */
export async function listTaskItems(
  userId: string,
  filters: TaskFilters,
  today: DateOnly,
): Promise<TaskItem[]> {
  const view = filters.view ?? "all";
  const dateField = filters.dateField ?? "doDate";
  const query = filters.q?.trim();

  const { from, to } = occurrenceWindow(view, filters, today);
  await ensureOccurrencesForRange(userId, from, to);

  const baseWhere: Prisma.TaskWhereInput = {
    userId,
    archivedAt: null,
    parentTaskId: null,
    ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    ...(filters.lifeAreaId ? { lifeAreaId: filters.lifeAreaId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.tagId ? { tags: { some: { id: filters.tagId } } } : {}),
    ...(filters.priority?.length ? { priority: { in: filters.priority } } : {}),
  };

  // --- Simple (non-recurring) tasks --------------------------------------
  const plainWhere: Prisma.TaskWhereInput = { ...baseWhere, isRecurring: false };
  if (view === "completed") {
    plainWhere.status = "COMPLETED";
  } else if (filters.status?.length) {
    plainWhere.status = { in: filters.status };
  } else {
    plainWhere.status = { notIn: ["COMPLETED", "CANCELLED"] };
  }

  if (view === "today") {
    plainWhere[dateField] = dateOnlyToDb(today);
  } else if (view === "upcoming") {
    plainWhere[dateField] = { gt: dateOnlyToDb(today), lte: dateOnlyToDb(to) };
  } else if (view === "overdue") {
    plainWhere[dateField] = { lt: dateOnlyToDb(today) };
  } else if (filters.from || filters.to) {
    plainWhere[dateField] = {
      ...(filters.from ? { gte: dateOnlyToDb(filters.from) } : {}),
      ...(filters.to ? { lte: dateOnlyToDb(filters.to) } : {}),
    };
  }

  const plainTasks = await db.task.findMany({
    where: plainWhere,
    select: taskSelect,
    orderBy: [{ [dateField]: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    take: 500,
  });

  // --- Recurring occurrences ---------------------------------------------
  const occurrenceWhere: Prisma.TaskOccurrenceWhereInput = {
    userId,
    scheduledFor: { gte: dateOnlyToDb(from), lte: dateOnlyToDb(to) },
    task: { ...baseWhere, isRecurring: true },
  };
  if (view === "completed") {
    occurrenceWhere.status = "COMPLETED";
  } else if (filters.status?.length) {
    const mapped = filters.status.map((status) =>
      status === "COMPLETED" ? "COMPLETED" : status === "CANCELLED" ? "SKIPPED" : "PENDING",
    );
    occurrenceWhere.status = { in: mapped as Prisma.EnumOccurrenceStatusFilter["in"] };
  } else {
    occurrenceWhere.status = { notIn: ["SKIPPED"] };
  }

  const occurrences = await db.taskOccurrence.findMany({
    where: occurrenceWhere,
    select: {
      id: true,
      seriesId: true,
      scheduledFor: true,
      movedTo: true,
      status: true,
      completedAt: true,
      actualMinutes: true,
      task: { select: taskSelect },
    },
    take: 500,
  });

  const items = [
    ...plainTasks.map(mapTaskRow),
    ...occurrences.map((occurrence) => mapOccurrenceRow(occurrence, occurrence.task)),
  ];

  await attachSubtaskCounts(userId, items);
  return sortItems(items);
}

async function attachSubtaskCounts(userId: string, items: TaskItem[]): Promise<void> {
  const parentIds = items.filter((item) => !item.occurrenceId).map((item) => item.taskId);
  if (parentIds.length === 0) return;

  const grouped = await db.task.groupBy({
    by: ["parentTaskId", "status"],
    where: { userId, parentTaskId: { in: parentIds }, archivedAt: null },
    _count: { _all: true },
  });

  const totals = new Map<string, { count: number; completed: number }>();
  for (const row of grouped) {
    if (!row.parentTaskId) continue;
    const entry = totals.get(row.parentTaskId) ?? { count: 0, completed: 0 };
    entry.count += row._count._all;
    if (row.status === "COMPLETED") entry.completed += row._count._all;
    totals.set(row.parentTaskId, entry);
  }

  for (const item of items) {
    const entry = totals.get(item.taskId);
    if (entry) {
      item.subtaskCount = entry.count;
      item.subtaskCompletedCount = entry.completed;
    }
  }
}

export interface TaskDetail extends TaskItem {
  subtasks: TaskItem[];
  createdAt: string;
  updatedAt: string;
  goalLinks: { goalId: string; goalTitle: string }[];
  reminders: { id: string; triggerAt: string; channel: string }[];
  occurrences: { id: string; scheduledFor: DateOnly; status: string }[];
}

export async function getTaskDetail(
  userId: string,
  taskId: string,
): Promise<TaskDetail | null> {
  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: {
      ...taskSelect,
      createdAt: true,
      updatedAt: true,
      subtasks: {
        select: taskSelect,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      goalLinks: { select: { goalId: true, goal: { select: { title: true } } } },
      reminders: {
        select: { id: true, triggerAt: true, channel: true },
        orderBy: { triggerAt: "asc" },
      },
      occurrences: {
        select: { id: true, scheduledFor: true, status: true },
        orderBy: { scheduledFor: "asc" },
        take: 60,
      },
    },
  });
  if (!task) return null;

  const base = mapTaskRow(task);
  base.subtaskCount = task.subtasks.length;
  base.subtaskCompletedCount = task.subtasks.filter((s) => s.status === "COMPLETED").length;

  return {
    ...base,
    subtasks: task.subtasks.map(mapTaskRow),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    goalLinks: task.goalLinks.map((link) => ({ goalId: link.goalId, goalTitle: link.goal.title })),
    reminders: task.reminders.map((reminder) => ({
      id: reminder.id,
      triggerAt: reminder.triggerAt.toISOString(),
      channel: reminder.channel,
    })),
    occurrences: task.occurrences.map((occurrence) => ({
      id: occurrence.id,
      scheduledFor: dbDateToDateOnly(occurrence.scheduledFor),
      status: occurrence.status,
    })),
  };
}

export interface TaskStats {
  today: number;
  overdue: number;
  upcoming: number;
  completedToday: number;
}

export async function getTaskStats(userId: string, today: DateOnly): Promise<TaskStats> {
  await ensureOccurrencesForRange(userId, addDays(today, -30), addDays(today, 30));
  const todayDb = dateOnlyToDb(today);
  const dayStart = dateOnlyToDb(today);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [plainToday, occToday, plainOverdue, plainUpcoming, completedToday, occCompletedToday] =
    await Promise.all([
      db.task.count({
        where: { userId, isRecurring: false, parentTaskId: null, archivedAt: null, doDate: todayDb, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      db.taskOccurrence.count({
        where: { userId, scheduledFor: todayDb, status: "PENDING" },
      }),
      db.task.count({
        where: { userId, isRecurring: false, parentTaskId: null, archivedAt: null, doDate: { lt: todayDb }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      db.task.count({
        where: { userId, isRecurring: false, parentTaskId: null, archivedAt: null, doDate: { gt: todayDb }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      db.task.count({
        where: { userId, completedAt: { gte: dayStart, lt: dayEnd } },
      }),
      db.taskOccurrence.count({
        where: { userId, completedAt: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

  return {
    today: plainToday + occToday,
    overdue: plainOverdue,
    upcoming: plainUpcoming,
    completedToday: completedToday + occCompletedToday,
  };
}

/** Lightweight option list for pickers (life areas of tasks, etc.). */
export async function listTaskOptions(userId: string) {
  return db.task.findMany({
    where: { userId, archivedAt: null, parentTaskId: null, isRecurring: false },
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export interface PickerOption {
  id: string;
  name: string;
  color?: string;
}

export interface TaskFormOptions {
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  tags: PickerOption[];
  parentTasks: { id: string; title: string }[];
}

export async function getTaskFormOptions(userId: string): Promise<TaskFormOptions> {
  const [lifeAreas, projects, tags, parentTasks] = await Promise.all([
    db.lifeArea.findMany({
      where: { userId, isArchived: false },
      select: { id: true, name: true, color: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    db.project.findMany({
      where: { userId, archivedAt: null, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.task.findMany({
      where: { userId, parentTaskId: null, archivedAt: null, isRecurring: false },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return { lifeAreas, projects, tags, parentTasks };
}
