"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { ok, fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { parseTimeToMinutes } from "@/lib/dates";
import { blockInputSchema, type BlockInput } from "@/features/timetable/schemas";

async function validateRelations(userId: string, data: BlockInput): Promise<string | null> {
  if (data.taskId) {
    const task = await db.task.findFirst({ where: { id: data.taskId, userId } });
    if (!task) return "Task not found";
  }
  if (data.lifeAreaId) {
    const area = await db.lifeArea.findFirst({ where: { id: data.lifeAreaId, userId } });
    if (!area) return "Life area not found";
  }
  return null;
}

export async function createBlock(input: BlockInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = blockInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const relationError = await validateRelations(user.id, data);
  if (relationError) return fail(relationError);

  const block = await db.timetableBlock.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      color: data.color,
      startMinutes: parseTimeToMinutes(data.start)!,
      endMinutes: parseTimeToMinutes(data.end)!,
      days: data.days,
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
  const existing = await db.timetableBlock.findFirst({ where: { id: data.id, userId: user.id } });
  if (!existing) return fail("Block not found");

  const relationError = await validateRelations(user.id, data);
  if (relationError) return fail(relationError);

  await db.timetableBlock.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      color: data.color,
      startMinutes: parseTimeToMinutes(data.start)!,
      endMinutes: parseTimeToMinutes(data.end)!,
      days: data.days,
      taskId: data.taskId || null,
      lifeAreaId: data.lifeAreaId || null,
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
