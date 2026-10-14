"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { ok, fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { parseTimeToMinutes } from "@/lib/dates";
import {
  templateInputSchema,
  blockInputSchema,
  weekdayAssignmentSchema,
  type TemplateInput,
  type BlockInput,
  type WeekdayAssignmentInput,
} from "@/features/timetable/schemas";

export async function createTemplate(input: TemplateInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const template = await db.timetableTemplate.create({
    data: { userId: user.id, name: data.name, description: data.description, dayType: data.dayType, isDefault: data.isDefault },
  });

  if (data.isDefault) {
    await db.timetableTemplate.updateMany({
      where: { userId: user.id, id: { not: template.id }, isDefault: true },
      data: { isDefault: false },
    });
  }

  revalidatePath("/timetable");
  return ok({ id: template.id });
}

export async function updateTemplate(input: TemplateInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));
  if (!parsed.data.id) return fail("Template ID required");

  const data = parsed.data;
  await db.timetableTemplate.updateMany({
    where: { id: data.id, userId: user.id },
    data: { name: data.name, description: data.description, dayType: data.dayType, isDefault: data.isDefault },
  });

  if (data.isDefault) {
    await db.timetableTemplate.updateMany({
      where: { userId: user.id, id: { not: data.id }, isDefault: true },
      data: { isDefault: false },
    });
  }

  revalidatePath("/timetable");
  return ok(undefined);
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  await db.timetableTemplate.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/timetable");
  return ok(undefined);
}

export async function setDefaultTemplate(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  await db.$transaction([
    db.timetableTemplate.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.timetableTemplate.updateMany({ where: { id, userId: user.id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/timetable");
  return ok(undefined);
}

export async function addBlock(input: BlockInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const template = await db.timetableTemplate.findFirst({ where: { id: data.templateId, userId: user.id } });
  if (!template) return fail("Template not found");

  if (data.taskId) {
    const task = await db.task.findFirst({ where: { id: data.taskId, userId: user.id } });
    if (!task) return fail("Task not found");
  }
  if (data.lifeAreaId) {
    const area = await db.lifeArea.findFirst({ where: { id: data.lifeAreaId, userId: user.id } });
    if (!area) return fail("Life area not found");
  }

  const maxOrder = await db.timetableBlock.aggregate({
    where: { templateId: data.templateId },
    _max: { order: true },
  });

  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const block = await db.timetableBlock.create({
    data: {
      userId: user.id,
      templateId: data.templateId,
      title: data.title,
      description: data.description,
      category: data.category,
      color: data.color,
      startMinutes: parseTimeToMinutes(data.start)!,
      endMinutes: parseTimeToMinutes(data.end)!,
      order: nextOrder,
      taskId: data.taskId || undefined,
      lifeAreaId: data.lifeAreaId || undefined,
    },
  });

  revalidatePath("/timetable");
  return ok({ id: block.id });
}

export async function updateBlock(input: BlockInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));
  if (!parsed.data.id) return fail("Block ID required");

  const data = parsed.data;
  const block = await db.timetableBlock.findFirst({ where: { id: data.id, userId: user.id } });
  if (!block) return fail("Block not found");

  if (data.taskId) {
    const task = await db.task.findFirst({ where: { id: data.taskId, userId: user.id } });
    if (!task) return fail("Task not found");
  }
  if (data.lifeAreaId) {
    const area = await db.lifeArea.findFirst({ where: { id: data.lifeAreaId, userId: user.id } });
    if (!area) return fail("Life area not found");
  }

  await db.timetableBlock.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      color: data.color,
      startMinutes: parseTimeToMinutes(data.start)!,
      endMinutes: parseTimeToMinutes(data.end)!,
      taskId: data.taskId || undefined,
      lifeAreaId: data.lifeAreaId || undefined,
    },
  });

  revalidatePath("/timetable");
  return ok(undefined);
}

export async function deleteBlock(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  await db.timetableBlock.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/timetable");
  return ok(undefined);
}

export async function reorderBlocks(templateId: string, orderedIds: string[]): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const template = await db.timetableTemplate.findFirst({ where: { id: templateId, userId: user.id } });
  if (!template) return fail("Template not found");

  await db.$transaction(
    orderedIds.map((id, index) =>
      db.timetableBlock.updateMany({ where: { id, templateId, userId: user.id }, data: { order: index } })
    )
  );

  revalidatePath("/timetable");
  return ok(undefined);
}

export async function assignTemplateToWeekday(input: WeekdayAssignmentInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = weekdayAssignmentSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  const { dayOfWeek, templateId } = parsed.data;
  if (templateId) {
    const template = await db.timetableTemplate.findFirst({ where: { id: templateId, userId: user.id } });
    if (!template) return fail("Template not found");
  }

  await db.weekdayTemplate.upsert({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
    update: { templateId },
    create: { userId: user.id, dayOfWeek, templateId },
  });

  revalidatePath("/timetable");
  return ok(undefined);
}

export async function clearWeekday(dayOfWeek: number): Promise<ActionResult> {
  return assignTemplateToWeekday({ dayOfWeek, templateId: null });
}