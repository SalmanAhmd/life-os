import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { TasksView } from "@/features/tasks/components/tasks-view";
import { getTaskFormOptions, listTaskItems } from "@/features/tasks/queries";
import type { TaskView } from "@/features/tasks/types";

export const metadata: Metadata = { title: "Tasks" };

const VIEWS: TaskView[] = ["all", "today", "upcoming", "overdue", "completed"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const view = (VIEWS.includes(params.view as TaskView) ? params.view : "all") as TaskView;
  const today = todayDateOnly(user.timezone);

  const [items, options] = await Promise.all([
    listTaskItems(user.id, { view }, today),
    getTaskFormOptions(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground text-sm">All tasks and recurring items.</p>
      </div>
      <TasksView items={items} options={options} today={today} view={view} />
    </div>
  );
}
