import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { formatDateOnlyLong, todayDateOnly } from "@/lib/dates";
import { TasksView } from "@/features/tasks/components/tasks-view";
import { getTaskFormOptions, listTaskItems } from "@/features/tasks/queries";

export const metadata: Metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [items, options] = await Promise.all([
    listTaskItems(user.id, { view: "today" }, today),
    getTaskFormOptions(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-muted-foreground text-sm">{formatDateOnlyLong(today)}</p>
      </div>
      <TasksView
        items={items}
        options={options}
        today={today}
        showTabs={false}
        emptyTitle="Nothing scheduled for today"
        emptyBody="Plan your day by adding a task below."
        defaultCreateDate={today}
      />
    </div>
  );
}
