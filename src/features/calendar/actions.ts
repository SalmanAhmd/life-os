"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  type DateOnly,
  addDays,
  dateOnlyToDb,
  parseTimeToMinutes,
  zonedDateTimeToUtc,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { calendarEventInputSchema } from "@/features/calendar/schemas";
import {
  type CalendarEventDetail,
  type CalendarItem,
  getEventForEdit as getEventForEditQuery,
  listCalendarItems,
} from "@/features/calendar/queries";
import type { RecurrenceInput } from "@/features/tasks/schemas";

function revalidateCalendar() {
  revalidatePath("/calendar");
  revalidatePath("/today");
}

async function resolveOwnedLifeArea(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.lifeArea.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

function eventInstants(
  date: DateOnly,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  allDay: boolean,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  if (allDay) {
    return {
      startsAt: zonedDateTimeToUtc(date, 0, timezone),
      endsAt: zonedDateTimeToUtc(addDays(date, 1), 0, timezone),
    };
  }
  const start = parseTimeToMinutes(startTime ?? "") ?? 0;
  const end = parseTimeToMinutes(endTime ?? "") ?? 0;
  return {
    startsAt: zonedDateTimeToUtc(date, start, timezone),
    endsAt: zonedDateTimeToUtc(date, end, timezone),
  };
}

function recurrenceRuleData(
  userId: string,
  timezone: string,
  recurrence: RecurrenceInput,
) {
  return {
    userId,
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    byWeekday: recurrence.byWeekday,
    byMonthDay: recurrence.byMonthDay ?? null,
    bySetPos: recurrence.bySetPos ?? null,
    byWeekdayForSetPos: recurrence.byWeekdayForSetPos ?? null,
    byMonth: recurrence.byMonth ?? null,
    startDate: dateOnlyToDb(recurrence.startDate),
    endDate: recurrence.endDate ? dateOnlyToDb(recurrence.endDate) : null,
    count: recurrence.count ?? null,
    timezone,
    exclusions: recurrence.exclusions,
  };
}

export async function createEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = calendarEventInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the event details.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const lifeAreaId = await resolveOwnedLifeArea(user.id, data.lifeAreaId);
  const { startsAt, endsAt } = eventInstants(
    data.date,
    data.startTime,
    data.endTime,
    data.allDay,
    user.timezone,
  );

  const eventId = await db.$transaction(async (tx) => {
    let recurrenceRuleId: string | null = null;
    if (data.recurrence) {
      const rule = await tx.recurrenceRule.create({
        data: recurrenceRuleData(user.id, user.timezone, data.recurrence),
      });
      recurrenceRuleId = rule.id;
    }

    const event = await tx.calendarEvent.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ?? null,
        startsAt,
        endsAt,
        allDay: data.allDay,
        lifeAreaId,
        recurrenceRuleId,
      },
      select: { id: true },
    });

    if (recurrenceRuleId) {
      await tx.calendarEvent.update({
        where: { id: event.id },
        data: { seriesId: event.id },
      });
    }
    return event.id;
  });

  revalidateCalendar();
  return ok({ id: eventId });
}

export async function updateEvent(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = calendarEventInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the event details.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing event id.");

  const existing = await db.calendarEvent.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true, recurrenceRuleId: true },
  });
  if (!existing) return fail("Event not found.");

  const lifeAreaId = await resolveOwnedLifeArea(user.id, data.lifeAreaId);
  const { startsAt, endsAt } = eventInstants(
    data.date,
    data.startTime,
    data.endTime,
    data.allDay,
    user.timezone,
  );

  await db.$transaction(async (tx) => {
    let recurrenceRuleId: string | null = existing.recurrenceRuleId;

    if (data.recurrence) {
      if (recurrenceRuleId) {
        await tx.recurrenceRule.update({
          where: { id: recurrenceRuleId },
          data: recurrenceRuleData(user.id, user.timezone, data.recurrence),
        });
      } else {
        const rule = await tx.recurrenceRule.create({
          data: recurrenceRuleData(user.id, user.timezone, data.recurrence),
        });
        recurrenceRuleId = rule.id;
      }
    } else if (recurrenceRuleId) {
      const oldRuleId = recurrenceRuleId;
      recurrenceRuleId = null;
      await tx.calendarEvent.update({
        where: { id: data.id },
        data: { recurrenceRuleId: null },
      });
      await tx.recurrenceRule.delete({ where: { id: oldRuleId } }).catch(() => undefined);
    }

    await tx.calendarEvent.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ?? null,
        startsAt,
        endsAt,
        allDay: data.allDay,
        lifeAreaId,
        recurrenceRuleId,
        seriesId: data.recurrence ? data.id : null,
      },
    });
  });

  revalidateCalendar();
  return ok({ id: data.id });
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const event = await db.calendarEvent.findFirst({
    where: { id, userId: user.id },
    select: { id: true, recurrenceRuleId: true },
  });
  if (!event) return fail("Event not found.");

  await db.$transaction(async (tx) => {
    await tx.calendarEvent.delete({ where: { id: event.id } });
    if (event.recurrenceRuleId) {
      await tx.recurrenceRule.delete({ where: { id: event.recurrenceRuleId } }).catch(() => undefined);
    }
  });

  revalidateCalendar();
  return ok(undefined);
}

export async function getEventForEdit(
  id: string,
): Promise<ActionResult<CalendarEventDetail | null>> {
  const user = await requireOnboardedUser();
  const detail = await getEventForEditQuery(user.id, id);
  return ok(detail);
}

export async function fetchCalendarItems(
  from: DateOnly,
  to: DateOnly,
): Promise<ActionResult<CalendarItem[]>> {
  const user = await requireOnboardedUser();
  const items = await listCalendarItems(user.id, { from, to }, user.timezone);
  return ok(items);
}
