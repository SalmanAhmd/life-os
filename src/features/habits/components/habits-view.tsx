"use client";

import { Archive, ArchiveRestore, Check, Flame, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { type DateOnly, formatDateOnly } from "@/lib/dates";
import { resolveIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  archiveHabit,
  deleteHabit,
  restoreHabit,
  toggleHabitCheckIn,
} from "@/features/habits/actions";
import { HabitFormDialog } from "@/features/habits/components/habit-form-dialog";
import type { HabitSummary } from "@/features/habits/queries";
import type { PickerOption } from "@/features/tasks/queries";

export function HabitsView({
  habits,
  lifeAreas,
  today,
}: {
  habits: HabitSummary[];
  lifeAreas: PickerOption[];
  today: DateOnly;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HabitSummary | null>(null);

  const active = habits.filter((habit) => !habit.isArchived);
  const archived = habits.filter((habit) => habit.isArchived);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New habit
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No habits yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Build consistency by tracking something small every day.
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
            <Plus className="size-4" />
            New habit
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              today={today}
              onEdit={() => {
                setEditing(habit);
                setDialogOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Archived</h2>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                today={today}
                onEdit={() => {
                  setEditing(habit);
                  setDialogOpen(true);
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <HabitFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        habit={editing}
        lifeAreas={lifeAreas}
      />
    </div>
  );
}

function HabitCard({
  habit,
  today,
  onEdit,
}: {
  habit: HabitSummary;
  today: DateOnly;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const Icon = resolveIcon(habit.icon);

  function toggle() {
    startTransition(async () => {
      const result = await toggleHabitCheckIn(habit.id, today);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
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

  const progress = habit.targetPerPeriod > 1
    ? Math.round((habit.todayValue / habit.targetPerPeriod) * 100)
    : habit.doneToday
      ? 100
      : 0;

  return (
    <li className="border-border/70 bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{habit.name}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3" />
              {habit.currentStreak} {habit.streakUnit}
              {habit.currentStreak === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{habit.completion30}% last 30d</span>
            {habit.lifeArea ? (
              <>
                <span>·</span>
                <span>{habit.lifeArea.name}</span>
              </>
            ) : null}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Habit actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            {habit.isArchived ? (
              <DropdownMenuItem onSelect={() => run(() => restoreHabit(habit.id), "Habit restored")}>
                <ArchiveRestore className="size-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(() => archiveHabit(habit.id), "Habit archived")}>
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run(() => deleteHabit(habit.id), "Habit deleted")}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {habit.targetPerPeriod > 1 ? <Progress value={progress} className="h-1.5" /> : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {habit.recent.slice(-14).map((day) => (
            <span
              key={day.date}
              title={`${formatDateOnly(day.date, { withYear: true })}: ${day.done ? "done" : "not done"}`}
              className={cn(
                "size-4 rounded-sm",
                day.done ? "bg-emerald-500" : "bg-muted",
                day.date === today && "ring-2 ring-emerald-500/40",
              )}
            />
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant={habit.doneToday ? "default" : "outline"}
          disabled={isPending}
          onClick={toggle}
          className="gap-1"
        >
          <Check className="size-4" />
          {habit.doneToday ? "Done" : "Check in"}
        </Button>
      </div>
    </li>
  );
}
