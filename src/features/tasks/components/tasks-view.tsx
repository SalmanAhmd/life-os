"use client";

import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTaskForEdit } from "@/features/tasks/actions";
import {
  TaskFormDialog,
  type TaskFormDefaults,
} from "@/features/tasks/components/task-form-dialog";
import { TaskItemRow } from "@/features/tasks/components/task-item-row";
import type {
  TaskDetail,
  TaskFormOptions,
} from "@/features/tasks/queries";
import type { TaskItem, TaskView } from "@/features/tasks/types";

const VIEW_TABS: { value: TaskView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

export function TasksView({
  items,
  options,
  today,
  view = "all",
  showTabs = true,
  emptyTitle = "No tasks",
  emptyBody = "Create your first task to get started.",
  defaultCreateDate,
}: {
  items: TaskItem[];
  options: TaskFormOptions;
  today: string;
  view?: TaskView;
  showTabs?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  defaultCreateDate?: string | null;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDetail | null>(null);
  const [defaults, setDefaults] = useState<TaskFormDefaults | undefined>();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setDefaults({
      doDate: defaultCreateDate ?? null,
      status: "TODO",
    });
    setDialogOpen(true);
  }

  function openEdit(item: TaskItem) {
    setLoadingId(item.id);
    startTransition(async () => {
      const result = await getTaskForEdit(item.taskId);
      setLoadingId(null);
      if (!result.ok || !result.data) {
        toast.error("Could not load task");
        return;
      }
      setEditing(result.data);
      setDefaults(undefined);
      setDialogOpen(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showTabs ? (
          <div className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg p-1 text-sm">
            {VIEW_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={`/tasks?view=${tab.value}`}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  view === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        ) : (
          <div />
        )}
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{emptyTitle}</p>
          <p className="text-muted-foreground mt-1 text-sm">{emptyBody}</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
            <Plus className="size-4" />
            New task
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="relative">
              {loadingId === item.id ? (
                <div className="text-muted-foreground bg-card/70 absolute inset-0 z-10 flex items-center justify-center rounded-md">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : null}
              <TaskItemRow item={item} today={today} onEdit={openEdit} />
            </li>
          ))}
        </ul>
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        options={options}
        task={editing}
        defaults={defaults}
        today={today}
      />
    </div>
  );
}
