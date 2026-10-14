"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import {
  lifeAreaInputSchema,
  lifeAreaReorderSchema,
} from "@/features/life-areas/schemas";

function revalidateLifeAreas() {
  revalidatePath("/settings/life-areas");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/goals");
  revalidatePath("/habits");
}

export async function createLifeArea(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = lifeAreaInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid life area.", zodFieldErrors(parsed.error));

  const duplicate = await db.lifeArea.findFirst({
    where: { userId: user.id, name: parsed.data.name },
    select: { id: true },
  });
  if (duplicate) return fail("You already have a life area with that name.", { name: ["Name already used"] });

  const count = await db.lifeArea.count({ where: { userId: user.id } });
  const area = await db.lifeArea.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      icon: parsed.data.icon,
      order: parsed.data.order ?? count,
    },
    select: { id: true },
  });

  revalidateLifeAreas();
  return ok({ id: area.id });
}

export async function updateLifeArea(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = lifeAreaInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid life area.", zodFieldErrors(parsed.error));
  if (!parsed.data.id) return fail("Missing life area id.");

  // Scope the update by userId so a user can never edit another user's record.
  const result = await db.lifeArea.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color,
      icon: parsed.data.icon,
    },
  });
  if (result.count === 0) return fail("Life area not found.");

  revalidateLifeAreas();
  return ok({ id: parsed.data.id });
}

export async function archiveLifeArea(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.lifeArea.updateMany({
    where: { id, userId: user.id },
    data: { isArchived: true },
  });
  if (result.count === 0) return fail("Life area not found.");
  revalidateLifeAreas();
  return ok(undefined);
}

export async function restoreLifeArea(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.lifeArea.updateMany({
    where: { id, userId: user.id },
    data: { isArchived: false },
  });
  if (result.count === 0) return fail("Life area not found.");
  revalidateLifeAreas();
  return ok(undefined);
}

export async function deleteLifeArea(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  // Deleting a life area sets related foreign keys to null (schema onDelete:
  // SetNull), so tasks/goals/etc. are preserved rather than destroyed.
  const result = await db.lifeArea.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("Life area not found.");
  revalidateLifeAreas();
  return ok(undefined);
}

export async function reorderLifeAreas(input: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = lifeAreaReorderSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid order.");

  await db.$transaction(
    parsed.data.ids.map((id, index) =>
      db.lifeArea.updateMany({ where: { id, userId: user.id }, data: { order: index } }),
    ),
  );

  revalidateLifeAreas();
  return ok(undefined);
}
