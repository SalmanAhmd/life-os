import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface PickerOption {
  id: string;
  name: string;
  color?: string | null;
}

const blockSelect = {
  id: true,
  templateId: true,
  title: true,
  description: true,
  category: true,
  color: true,
  startMinutes: true,
  endMinutes: true,
  order: true,
  isRecurring: true,
  taskId: true,
  lifeAreaId: true,
  task: { select: { id: true, title: true } },
  lifeArea: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TimetableBlockSelect;

export interface TimetableBlock {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: string | null;
  color: string | null;
  startMinutes: number;
  endMinutes: number;
  order: number;
  isRecurring: boolean;
  taskId: string | null;
  lifeAreaId: string | null;
  task: { id: string; title: string } | null;
  lifeArea: { id: string; name: string; color: string } | null;
}

export interface TimetableTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  dayType: string;
  isDefault: boolean;
  blocks: TimetableBlock[];
}

export interface WeekdayAssignment {
  dayOfWeek: number;
  templateId: string | null;
}

export interface TimetableBoard {
  templates: TimetableTemplateSummary[];
  assignments: WeekdayAssignment[];
}

export async function listTemplates(userId: string): Promise<TimetableTemplateSummary[]> {
  const templates = await db.timetableTemplate.findMany({
    where: { userId },
    include: {
      blocks: {
        orderBy: [{ order: "asc" }, { startMinutes: "asc" }],
        include: {
          task: { select: { id: true, title: true } },
          lifeArea: { select: { id: true, name: true, color: true } },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    dayType: t.dayType,
    isDefault: t.isDefault,
    blocks: t.blocks.map((b) => ({
      id: b.id,
      templateId: b.templateId,
      title: b.title,
      description: b.description,
      category: b.category,
      color: b.color,
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
      order: b.order,
      isRecurring: b.isRecurring,
      taskId: b.taskId,
      lifeAreaId: b.lifeAreaId,
      task: b.task,
      lifeArea: b.lifeArea,
    })),
  }));
}

export async function getTemplateDetail(userId: string, id: string): Promise<TimetableTemplateSummary | null> {
  const template = await db.timetableTemplate.findFirst({
    where: { id, userId },
    include: {
      blocks: {
        orderBy: [{ order: "asc" }, { startMinutes: "asc" }],
        include: {
          task: { select: { id: true, title: true } },
          lifeArea: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    dayType: template.dayType,
    isDefault: template.isDefault,
    blocks: template.blocks.map((b) => ({
      id: b.id,
      templateId: b.templateId,
      title: b.title,
      description: b.description,
      category: b.category,
      color: b.color,
      startMinutes: b.startMinutes,
      endMinutes: b.endMinutes,
      order: b.order,
      isRecurring: b.isRecurring,
      taskId: b.taskId,
      lifeAreaId: b.lifeAreaId,
      task: b.task,
      lifeArea: b.lifeArea,
    })),
  };
}

export async function getTimetableBoard(userId: string): Promise<TimetableBoard> {
  const [templates, assignments] = await Promise.all([
    listTemplates(userId),
    db.weekdayTemplate.findMany({
      where: { userId },
      select: { dayOfWeek: true, templateId: true },
    }),
  ]);

  const assignmentMap = new Map(assignments.map((a) => [a.dayOfWeek, a.templateId]));
  const assignmentsArray: WeekdayAssignment[] = [];
  for (let i = 0; i < 7; i++) {
    assignmentsArray.push({ dayOfWeek: i, templateId: assignmentMap.get(i) ?? null });
  }

  return { templates, assignments: assignmentsArray };
}

export async function getTemplateForEdit(userId: string, id: string): Promise<TimetableTemplateSummary | null> {
  return getTemplateDetail(userId, id);
}