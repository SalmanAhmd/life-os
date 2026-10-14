import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, todayDateOnly } from "@/lib/dates";
import { CalendarView } from "@/features/calendar/components/calendar-view";
import { listCalendarItems } from "@/features/calendar/queries";
import { getTaskFormOptions } from "@/features/tasks/queries";

const WEEK_STARTS_ON = 0;

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const user = await requireUser();
  const timezone = user.timezone;
  const today = todayDateOnly(timezone);
  const from = startOfWeek(startOfMonth(today), WEEK_STARTS_ON);
  const to = endOfWeek(endOfMonth(today), WEEK_STARTS_ON);

  const [items, options] = await Promise.all([
    listCalendarItems(user.id, { from, to }, timezone),
    getTaskFormOptions(user.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm">
          Plan your time with events, tasks and recurring schedules.
        </p>
      </div>
      <CalendarView items={items} lifeAreas={options.lifeAreas} timezone={timezone} today={today} />
    </div>
  );
}
