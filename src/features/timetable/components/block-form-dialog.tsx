"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBlock, updateBlock, deleteBlock } from "@/features/timetable/actions";
import {
  ALL_DAYS,
  WEEKDAY_DAYS,
  WEEKEND_DAYS,
  blockInputSchema,
  type BlockInput,
} from "@/features/timetable/schemas";
import type { PickerOption, TimetableBlock } from "@/features/timetable/queries";
import { cn } from "@/lib/utils";

interface BlockFormDialogProps {
  block: TimetableBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifeAreas: PickerOption[];
  taskOptions: PickerOption[];
  defaultDays?: number[];
}

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function sameDays(a: number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((d) => setA.has(d));
}

export function BlockFormDialog({
  block,
  open,
  onOpenChange,
  lifeAreas,
  taskOptions,
  defaultDays = [...WEEKDAY_DAYS],
}: BlockFormDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<BlockInput>({
    resolver: zodResolver(blockInputSchema),
    defaultValues: block
      ? {
          id: block.id,
          title: block.title,
          description: block.description ?? "",
          category: block.category ?? "",
          color: block.color ?? "",
          start: formatMinutesToTime(block.startMinutes),
          end: formatMinutesToTime(block.endMinutes),
          days: block.days,
          taskId: block.taskId ?? "",
          lifeAreaId: block.lifeAreaId ?? "",
        }
      : {
          title: "",
          description: "",
          category: "",
          color: "",
          start: "09:00",
          end: "10:00",
          days: [...defaultDays],
          taskId: "",
          lifeAreaId: "",
        },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      block
        ? {
            id: block.id,
            title: block.title,
            description: block.description ?? "",
            category: block.category ?? "",
            color: block.color ?? "",
            start: formatMinutesToTime(block.startMinutes),
            end: formatMinutesToTime(block.endMinutes),
            days: block.days,
            taskId: block.taskId ?? "",
            lifeAreaId: block.lifeAreaId ?? "",
          }
        : {
            title: "",
            description: "",
            category: "",
            color: "",
            start: "09:00",
            end: "10:00",
            days: [...defaultDays],
            taskId: "",
            lifeAreaId: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, block]);

  function onSubmit(data: BlockInput) {
    startTransition(async () => {
      const result = block
        ? await updateBlock({ ...data, id: block.id })
        : await createBlock(data);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save block");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof BlockInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      toast.success(block ? "Block updated" : "Block added");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!block) return;
    startTransition(async () => {
      const result = await deleteBlock(block.id);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete block");
        return;
      }
      toast.success("Block deleted");
      onOpenChange(false);
    });
  }

  const selectedDays = form.watch("days") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{block ? "Edit block" : "Add block"}</DialogTitle>
          <DialogDescription>
            {block ? "Update this time block" : "Add a time block to your week"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Deep work" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repeat on</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={sameDays(selectedDays, WEEKDAY_DAYS) ? "default" : "outline"}
                      onClick={() => field.onChange([...WEEKDAY_DAYS])}
                    >
                      Weekdays
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={sameDays(selectedDays, WEEKEND_DAYS) ? "default" : "outline"}
                      onClick={() => field.onChange([...WEEKEND_DAYS])}
                    >
                      Weekend
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={sameDays(selectedDays, ALL_DAYS) ? "default" : "outline"}
                      onClick={() => field.onChange([...ALL_DAYS])}
                    >
                      Every day
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {ALL_DAYS.map((day) => {
                      const active = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            const next = active
                              ? selectedDays.filter((d) => d !== day)
                              : [...selectedDays, day];
                            field.onChange(next);
                          }}
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-md border transition-colors",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:bg-accent",
                          )}
                        >
                          {DAY_LABELS[day]}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Details..." {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Work, Exercise, Personal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all",
                          field.value === color ? "border-primary scale-110" : "border-transparent hover:border-muted-foreground/50",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <Input
                      placeholder="#hex"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taskId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link task (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a task" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {taskOptions.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No tasks</div>
                      ) : (
                        taskOptions.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lifeAreaId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Life area (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a life area" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lifeAreas.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No life areas</div>
                      ) : (
                        lifeAreas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color ?? "#6366f1" }} />
                              {area.name}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className={cn(block && "justify-between")}>
              {block && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
                  Delete
                </Button>
              )}
              <div className={cn("flex gap-2", block && "flex-1 justify-end")}>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {block ? "Save changes" : "Add block"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
