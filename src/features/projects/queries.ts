import "server-only";

import type { DateOnly } from "@/lib/dates";
import { dbDateToDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: DateOnly | null;
  targetDate: DateOnly | null;
  completedAt: DateOnly | null;
  archivedAt: DateOnly | null;
  progress: number;
  taskCount: number;
  taskDoneCount: number;
  milestoneCount: number;
  milestoneDoneCount: number;
  lifeArea: { id: string; name: string; color: string } | null;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate: DateOnly | null;
  completed: boolean;
  order: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  status: string;
  doDate: DateOnly | null;
}

export interface ProjectDetail extends ProjectSummary {
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
}

type ProjectRow = Awaited<ReturnType<typeof fetchProjects>>[number];

async function fetchProjects(userId: string, includeArchived: boolean) {
  return db.project.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    include: {
      lifeArea: { select: { id: true, name: true, color: true } },
      tasks: { select: { id: true, title: true, status: true, doDate: true } },
      milestones: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

function toSummary(row: ProjectRow): ProjectSummary {
  const taskCount = row.tasks.length;
  const taskDoneCount = row.tasks.filter((task) => task.status === "COMPLETED").length;
  const milestoneCount = row.milestones.length;
  const milestoneDoneCount = row.milestones.filter((milestone) => Boolean(milestone.completedAt)).length;
  const progress = taskCount === 0 ? 0 : Math.round((taskDoneCount / taskCount) * 100);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate ? dbDateToDateOnly(row.startDate) : null,
    targetDate: row.targetDate ? dbDateToDateOnly(row.targetDate) : null,
    completedAt: row.completedAt ? dbDateToDateOnly(row.completedAt) : null,
    archivedAt: row.archivedAt ? dbDateToDateOnly(row.archivedAt) : null,
    progress,
    taskCount,
    taskDoneCount,
    milestoneCount,
    milestoneDoneCount,
    lifeArea: row.lifeArea,
  };
}

function toDetail(row: ProjectRow): ProjectDetail {
  const summary = toSummary(row);
  const milestones: ProjectMilestone[] = row.milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    dueDate: milestone.dueDate ? dbDateToDateOnly(milestone.dueDate) : null,
    completed: Boolean(milestone.completedAt),
    order: milestone.order,
  }));
  const tasks: ProjectTask[] = row.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    doDate: task.doDate ? dbDateToDateOnly(task.doDate) : null,
  }));

  return {
    ...summary,
    milestones,
    tasks,
  };
}

export async function listProjects(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ProjectSummary[]> {
  const rows = await fetchProjects(userId, options.includeArchived ?? false);
  return rows.map(toSummary);
}

export async function getProjectDetail(
  userId: string,
  id: string,
): Promise<ProjectDetail | null> {
  const row = await db.project.findFirst({
    where: { id, userId },
    include: {
      lifeArea: { select: { id: true, name: true, color: true } },
      tasks: { select: { id: true, title: true, status: true, doDate: true } },
      milestones: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!row) return null;
  return toDetail(row);
}
