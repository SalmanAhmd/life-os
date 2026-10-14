"use client";

import {
  CalendarClock,
  Check,
  Circle,
  Flag,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type DateOnly, formatMinutes, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  deleteTask,
  excludeOccurrence,
  toggleOccurrence,
  toggleOccurrenceSkip,
  toggleTaskComplete,
} from "@/features/tasks/actions";
import type { TaskItem } from "@/features/tasks/types";

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-500",
  HIGH: "text-orange-500",
  MEDIUM: "text-muted-foreground",
  LOW: "text-muted-foreground",
};

export function TaskItemRow({
  item,
  today,
  onEdit,
}: {
  item: TaskItem;
  today: DateOnly;
  onEdit: (item: TaskItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isDone = item.status === "COMPLETED";

  function toggle() {
    startTransition(async () => {
      const result = item.occurrenceId
        ? await toggleOccurrence(item.occurrenceId)
        : await toggleTaskComplete(item.taskId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isDone ? "Reopened" : "Completed");
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(message);
    });
  }

  return (
    <div className="border-border/70 bg-card group flex items-start gap-3 rounded-md border px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          isDone
            ? "bg-primary text-primary-foreground border-primary"
            : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {isDone ? <Check className="size-3" /> : <Circle className="size-3 opacity-0" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="text-left text-sm font-medium"
        >
          <span className={cn(isDone && "text-muted-foreground line-through")}>
            {item.title}
          </span>
        </button>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {item.doDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" />
              {relativeDayLabel(item.doDate, today)}
            </span>
          ) : null}
          {item.startMinutes != null ? <span>{formatMinutes(item.startMinutes)}</span> : null}
          {item.lifeArea ? (
            <span className="inline-flex items-center gap-1">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.lifeArea.color }}
              />
              {item.lifeArea.name}
            </span>
          ) : null}
          {item.project ? <span>{item.project.name}</span> : null}
          {item.recurrenceLabel ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" />
              {item.recurrenceLabel}
            </span>
          ) : null}
          {item.subtaskCount > 0 ? (
            <span>
              {item.subtaskCompletedCount}/{item.subtaskCount} subtasks
            </span>
          ) : null}
          {item.priority !== "MEDIUM" && item.priority !== "LOW" ? (
            <span className={cn("inline-flex items-center gap-1", PRIORITY_COLORS[item.priority])}>
              <Flag className="size-3" />
              {item.priority.toLowerCase()}
            </span>
          ) : null}
        </div>

        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Task actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(item)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          {item.occurrenceId ? (
            <>
              <DropdownMenuItem
                onSelect={() =>
                  run(() => toggleOccurrenceSkip(item.occurrenceId!), "Occurrence skipped")
                }
              >
                <SkipForward className="size-4" />
                Skip this time
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(() => excludeOccurrence(item.occurrenceId!), "Occurrence removed")
                }
              >
                <MoveRight className="size-4" />
                Remove from series
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => deleteTask(item.taskId), "Task deleted")}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-xs">
            {item.occurrenceId ? "Recurring occurrence" : "Single task"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
