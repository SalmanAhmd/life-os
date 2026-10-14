"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { ok, fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { dateOnlyToDb } from "@/lib/dates";
import {
  profileInputSchema,
  preferencesInputSchema,
  scheduleInputSchema,
  notificationsInputSchema,
  type ProfileInput,
  type PreferencesInput,
  type ScheduleInput,
  type NotificationsInput,
} from "@/features/settings/schemas";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name ?? undefined,
      timezone: parsed.data.timezone,
      image: parsed.data.image ?? undefined,
    },
  });

  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function updatePreferences(input: PreferencesInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = preferencesInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  await db.userPreferences.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  revalidatePath("/settings/preferences");
  revalidatePath("/settings/schedule");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function updateSchedule(input: ScheduleInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = scheduleInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  const data = parsed.data;

  await db.scheduleSettings.upsert({
    where: { userId: user.id },
    update: {
      saturdayRule: data.saturdayRule,
      workingDays: data.workingDays,
      alternateSaturdayWeeks: data.alternateSaturdayWeeks,
      alternateSaturdayAnchor: data.alternateSaturdayAnchor ? dateOnlyToDb(data.alternateSaturdayAnchor) : null,
      dayStartMinutes: parseTimeToMinutes(data.dayStart),
      dayEndMinutes: parseTimeToMinutes(data.dayEnd),
      holidays: data.holidays,
      exceptionalWorkdays: data.exceptionalWorkdays,
    },
    create: {
      userId: user.id,
      saturdayRule: data.saturdayRule,
      workingDays: data.workingDays,
      alternateSaturdayWeeks: data.alternateSaturdayWeeks,
      alternateSaturdayAnchor: data.alternateSaturdayAnchor ? dateOnlyToDb(data.alternateSaturdayAnchor) : null,
      dayStartMinutes: parseTimeToMinutes(data.dayStart),
      dayEndMinutes: parseTimeToMinutes(data.dayEnd),
      holidays: data.holidays,
      exceptionalWorkdays: data.exceptionalWorkdays,
    },
  });

  revalidatePath("/settings/schedule");
  revalidatePath("/settings/preferences");
  revalidatePath("/timetable");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function updateNotifications(input: NotificationsInput): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = notificationsInputSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input", zodFieldErrors(parsed.error));

  await db.userPreferences.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  revalidatePath("/settings/notifications");
  return ok(undefined);
}