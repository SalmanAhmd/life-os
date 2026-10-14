import "server-only";

import type { Prisma } from "@prisma/client";

import {
  type DateOnly,
  addDays,
  compareDateOnly,
  dateOnlyToDb,
  dbDateToDateOnly,
  formatInstant,
  localDateOnly,
  parseTimeToMinutes,
  zonedDateTimeToUtc,
} from "@/lib/dates";
import { db } from "@/lib/db";
import { formatRecurrence, getOccurrences } from "@/lib/recurrence";
import { ruleToDefinition } from "@/lib/recurrence/mapping";
import { ensureOccurrencesForRange } from "@/features/tasks/queries";
import type { RecurrenceInput } from "@/features/tasks/schemas";

export interface CalendarItem {
  kind: "event" | "task";
  id: string;
  title: string;
  allDay: boolean;
  start: string | null;
  end: string | null;
  dateOnly: DateOnly | null;
  lifeArea: { id: string; name: string; color: string } | null;
  color: string | null;
  recurrenceLabel: string | null;
  eventSeriesId: string | null;
}

const eventSelect = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  seriesId: true,
  lifeArea: { select: { id: true, name: true, color: true } },
  recurrenceRule: true,
} satisfies Prisma.CalendarEventSelect;

type EventRow = Prisma.CalendarEventGetPayload<{ select: typeof eventSelect }>;

function localMinutes(instant: Date, timezone: string): number {
  return parseTimeToMinutes(formatInstant(instant, timezone, "HH:mm")) ?? 0;
}

function singleEventItem(event: EventRow, timezone: string): CalendarItem {
  return {
    kind: "event",
    id: event.id,
    title: event.title,
    allDay: event.allDay,
    start: event.startsAt.toISOString(),
    end: event.endsAt.toISOString(),
    dateOnly: event.allDay ? localDateOnly(event.startsAt, timezone) : null,
    lifeArea: event.lifeArea,
    color: event.lifeArea?.color ?? null,
    recurrenceLabel: null,
    eventSeriesId: event.seriesId,
  };
}

function recurringEventItem(event: EventRow, date: DateOnly, timezone: string): CalendarItem {
  const recurrenceLabel = event.recurrenceRule
    ? formatRecurrence(ruleToDefinition(event.recurrenceRule))
    : null;

  if (event.allDay) {
    return {
      kind: "event",
      id: `${event.id}:${date}`,
      title: event.title,
      allDay: true,
      start: zonedDateTimeToUtc(date, 0, timezone).toISOString(),
      end: zonedDateTimeToUtc(addDays(date, 1), 0, timezone).toISOString(),
      dateOnly: date,
      lifeArea: event.lifeArea,
      color: event.lifeArea?.color ?? null,
      recurrenceLabel,
      eventSeriesId: event.seriesId ?? event.id,
    };
  }

  return {
    kind: "event",
    id: `${event.id}:${date}`,
    title: event.title,
    allDay: false,
    start: zonedDateTimeToUtc(date, localMinutes(event.startsAt, timezone), timezone).toISOString(),
    end: zonedDateTimeToUtc(date, localMinutes(event.endsAt, timezone), timezone).toISOString(),
    dateOnly: null,
    lifeArea: event.lifeArea,
    color: event.lifeArea?.color ?? null,
    recurrenceLabel,
    eventSeriesId: event.seriesId ?? event.id,
  };
}

function compareCalendarItems(a: CalendarItem, b: CalendarItem, timezone: string): number {
  const aDate = a.dateOnly ?? (a.start ? localDateOnly(new Date(a.start), timezone) : "9999-12-31");
  const bDate = b.dateOnly ?? (b.start ? localDateOnly(new Date(b.start), timezone) : "9999-12-31");
  const byDate = compareDateOnly(aDate, bDate);
  if (byDate !== 0) return byDate;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const aTime = a.allDay || !a.start ? -1 : localMinutes(new Date(a.start), timezone);
  const bTime = b.allDay || !b.start ? -1 : localMinutes(new Date(b.start), timezone);
  if (aTime !== bTime) return aTime - bTime;
  return a.title.localeCompare(b.title);
}

/** Unified list of calendar events (expanded), tasks and task occurrences. */
export async function listCalendarItems(
  userId: string,
  range: { from: DateOnly; to: DateOnly },
  timezone: string,
): Promise<CalendarItem[]> {
  const { from, to } = range;
  if (compareDateOnly(from, to) > 0) return [];

  await ensureOccurrencesForRange(userId, from, to);

  const fromInstant = zonedDateTimeToUtc(from, 0, timezone);
  const toInstant = zonedDateTimeToUtc(addDays(to, 1), 0, timezone);

  const [singleEvents, recurringEvents, tasks, occurrences] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        userId,
        recurrenceRuleId: null,
        startsAt: { lt: toInstant },
        endsAt: { gt: fromInstant },
      },
      select: eventSelect,
      orderBy: { startsAt: "asc" },
      take: 1000,
    }),
    db.calendarEvent.findMany({
      where: { userId, recurrenceRuleId: { not: null } },
      select: eventSelect,
    }),
    db.task.findMany({
      where: {
        userId,
        archivedAt: null,
        parentTaskId: null,
        isRecurring: false,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        doDate: { gte: dateOnlyToDb(from), lte: dateOnlyToDb(to) },
      },
      select: {
        id: true,
        title: true,
        doDate: true,
        lifeArea: { select: { id: true, name: true, color: true } },
      },
      orderBy: { doDate: "asc" },
      take: 1000,
    }),
    db.taskOccurrence.findMany({
      where: {
        userId,
        scheduledFor: { gte: dateOnlyToDb(from), lte: dateOnlyToDb(to) },
        status: { notIn: ["COMPLETED", "SKIPPED"] },
        task: { archivedAt: null, status: { notIn: ["CANCELLED"] } },
      },
      select: {
        id: true,
        scheduledFor: true,
        movedTo: true,
        task: {
          select: {
            id: true,
            title: true,
            lifeArea: { select: { id: true, name: true, color: true } },
            recurrenceRule: true,
          },
        },
      },
      take: 1000,
    }),
  ]);

  const items: CalendarItem[] = [
    ...singleEvents.map((event) => singleEventItem(event, timezone)),
    ...tasks
      .filter((task) => task.doDate != null)
      .map<CalendarItem>((task) => ({
        kind: "task",
        id: task.id,
        title: task.title,
        allDay: true,
        start: null,
        end: null,
        dateOnly: dbDateToDateOnly(task.doDate as Date),
        lifeArea: task.lifeArea,
        color: task.lifeArea?.color ?? null,
        recurrenceLabel: null,
        eventSeriesId: null,
      })),
    ...occurrences.map<CalendarItem>((occurrence) => {
      const scheduled = occurrence.movedTo ?? occurrence.scheduledFor;
      return {
        kind: "task",
        id: occurrence.id,
        title: occurrence.task.title,
        allDay: true,
        start: null,
        end: null,
        dateOnly: dbDateToDateOnly(scheduled),
        lifeArea: occurrence.task.lifeArea,
        color: occurrence.task.lifeArea?.color ?? null,
        recurrenceLabel: occurrence.task.recurrenceRule
          ? formatRecurrence(ruleToDefinition(occurrence.task.recurrenceRule))
          : null,
        eventSeriesId: null,
      };
    }),
  ];

  for (const event of recurringEvents) {
    if (!event.recurrenceRule) continue;
    const dates = getOccurrences(ruleToDefinition(event.recurrenceRule), { from, to });
    for (const date of dates) {
      items.push(recurringEventItem(event, date, timezone));
    }
  }

  return items.sort((a, b) => compareCalendarItems(a, b, timezone));
}

export interface CalendarEventDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meetingUrl: string | null;
  date: DateOnly;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  lifeAreaId: string | null;
  recurrence: RecurrenceInput | null;
  seriesId: string | null;
}

export async function getEventForEdit(
  userId: string,
  id: string,
): Promise<CalendarEventDetail | null> {
  const event = await db.calendarEvent.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      meetingUrl: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      lifeAreaId: true,
      seriesId: true,
      recurrenceRule: true,
    },
  });
  if (!event) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone ?? "UTC";

  const definition = event.recurrenceRule ? ruleToDefinition(event.recurrenceRule) : null;
  const recurrence: RecurrenceInput | null = definition
    ? {
        frequency: definition.frequency,
        interval: definition.interval,
        byWeekday: definition.byWeekday,
        byMonthDay: definition.byMonthDay,
        bySetPos: definition.bySetPos as -1 | 1 | 2 | 3 | 4 | null,
        byWeekdayForSetPos: definition.byWeekdayForSetPos as number | null | undefined,
        byMonth: definition.byMonth as number | null | undefined,
        startDate: definition.startDate,
        endDate: definition.endDate,
        count: definition.count,
        exclusions: definition.exclusions,
      }
    : null;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    meetingUrl: event.meetingUrl,
    date: localDateOnly(event.startsAt, timezone),
    startTime: formatInstant(event.startsAt, timezone, "HH:mm"),
    endTime: formatInstant(event.endsAt, timezone, "HH:mm"),
    allDay: event.allDay,
    lifeAreaId: event.lifeAreaId,
    recurrence,
    seriesId: event.seriesId,
  };
}
