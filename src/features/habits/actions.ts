"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { type DateOnly, dateOnlyToDb } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  DEFAULT_POINT_RULES,
  type PointRules,
  buildHabitAward,
  habitRewardKey,
} from "@/lib/rewards/rules";
import { awardOnce, pointRulesFromPreferences, reverseAward } from "@/features/rewards/service";
import { habitCheckInSchema, habitInputSchema } from "@/features/habits/schemas";

function revalidateHabits() {
  revalidatePath("/habits");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath("/rewards");
}

async function rulesFor(userId: string): Promise<PointRules> {
  const preferences = await db.userPreferences.findUnique({ where: { userId } });
  return preferences ? pointRulesFromPreferences(preferences) : DEFAULT_POINT_RULES;
}

async function resolveLifeArea(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.lifeArea.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

export async function createHabit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the habit.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const existing = await db.habit.findFirst({
    where: { userId: user.id, name: data.name },
    select: { id: true },
  });
  if (existing) return fail("You already have a habit with that name.", { name: ["Name already used"] });

  const habit = await db.habit.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      frequency: data.frequency,
      targetPerPeriod: data.targetPerPeriod,
      weekdays: data.frequency === "CUSTOM" ? data.weekdays : [],
      unit: data.unit ?? null,
      color: data.color,
      icon: data.icon,
      lifeAreaId: await resolveLifeArea(user.id, data.lifeAreaId),
    },
    select: { id: true },
  });

  revalidateHabits();
  return ok({ id: habit.id });
}

export async function updateHabit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = habitInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the habit.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing habit id.");

  const result = await db.habit.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      name: data.name,
      description: data.description ?? null,
      frequency: data.frequency,
      targetPerPeriod: data.targetPerPeriod,
      weekdays: data.frequency === "CUSTOM" ? data.weekdays : [],
      unit: data.unit ?? null,
      color: data.color,
      icon: data.icon,
      lifeAreaId: await resolveLifeArea(user.id, data.lifeAreaId),
    },
  });
  if (result.count === 0) return fail("Habit not found.");
  revalidateHabits();
  return ok({ id: data.id });
}

export async function archiveHabit(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.habit.updateMany({
    where: { id, userId: user.id },
    data: { isArchived: true, archivedAt: new Date() },
  });
  if (result.count === 0) return fail("Habit not found.");
  revalidateHabits();
  return ok(undefined);
}

export async function restoreHabit(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.habit.updateMany({
    where: { id, userId: user.id },
    data: { isArchived: false, archivedAt: null },
  });
  if (result.count === 0) return fail("Habit not found.");
  revalidateHabits();
  return ok(undefined);
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.habit.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("Habit not found.");
  revalidateHabits();
  return ok(undefined);
}

async function setValueInternal(
  userId: string,
  habitId: string,
  date: DateOnly,
  value: number,
): Promise<ActionResult<{ value: number }>> {
  const habit = await db.habit.findFirst({
    where: { id: habitId, userId },
    select: { id: true, targetPerPeriod: true },
  });
  if (!habit) return fail("Habit not found.");

  const rules = await rulesFor(userId);
  const key = habitRewardKey(habitId, date);

  await db.$transaction(async (tx) => {
    if (value <= 0) {
      await tx.habitCheckIn.deleteMany({ where: { habitId, userId, date: dateOnlyToDb(date) } });
      await reverseAward(tx, userId, key, { habitId });
      return;
    }

    await tx.habitCheckIn.upsert({
      where: { habitId_date: { habitId, date: dateOnlyToDb(date) } },
      update: { value },
      create: { userId, habitId, date: dateOnlyToDb(date), value },
    });

    const completed = value >= habit.targetPerPeriod;
    const award = buildHabitAward(habitId, date, rules);
    if (completed && award) {
      await awardOnce(tx, userId, award, { habitId });
    } else if (!completed) {
      await reverseAward(tx, userId, key, { habitId });
    }
  });

  revalidateHabits();
  return ok({ value });
}

export async function toggleHabitCheckIn(
  habitId: string,
  date: string,
): Promise<ActionResult<{ value: number }>> {
  const user = await requireOnboardedUser();
  const parsed = habitCheckInSchema.safeParse({ habitId, date });
  if (!parsed.success) return fail("Invalid check-in.");

  const habit = await db.habit.findFirst({
    where: { id: habitId, userId: user.id },
    select: { targetPerPeriod: true },
  });
  if (!habit) return fail("Habit not found.");

  const existing = await db.habitCheckIn.findUnique({
    where: { habitId_date: { habitId, date: dateOnlyToDb(date) } },
    select: { value: true },
  });
  const current = existing?.value ?? 0;
  const next = current >= habit.targetPerPeriod ? 0 : habit.targetPerPeriod;
  return setValueInternal(user.id, habitId, date, next);
}

export async function setHabitValue(
  habitId: string,
  date: string,
  value: number,
): Promise<ActionResult<{ value: number }>> {
  const user = await requireOnboardedUser();
  const parsed = habitCheckInSchema.safeParse({ habitId, date, value });
  if (!parsed.success) return fail("Invalid check-in.");
  return setValueInternal(user.id, habitId, date, Math.max(0, value));
}
