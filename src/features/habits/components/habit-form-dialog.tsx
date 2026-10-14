"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { weekdayShort } from "@/lib/dates";
import { ICON_NAMES, resolveIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { createHabit, updateHabit } from "@/features/habits/actions";
import { type HabitInput, habitInputSchema } from "@/features/habits/schemas";
import type { HabitSummary } from "@/features/habits/queries";
import type { PickerOption } from "@/features/tasks/queries";

const COLORS = ["#10b981", "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#06b6d4"];

export function HabitFormDialog({
  open,
  onOpenChange,
  habit,
  lifeAreas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: HabitSummary | null;
  lifeAreas: PickerOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<HabitInput>({
    resolver: zodResolver(habitInputSchema),
    defaultValues: {
      name: "",
      description: "",
      frequency: "DAILY",
      targetPerPeriod: 1,
      weekdays: [],
      unit: "",
      color: COLORS[0]!,
      icon: "check",
      lifeAreaId: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (habit) {
      form.reset({
        id: habit.id,
        name: habit.name,
        description: habit.description ?? "",
        frequency: habit.frequency,
        targetPerPeriod: habit.targetPerPeriod,
        weekdays: habit.weekdays,
        unit: habit.unit ?? "",
        color: habit.color,
        icon: habit.icon,
        lifeAreaId: habit.lifeArea?.id ?? null,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        frequency: "DAILY",
        targetPerPeriod: 1,
        weekdays: [],
        unit: "",
        color: COLORS[0]!,
        icon: "check",
        lifeAreaId: null,
      });
    }
  }, [open, habit, form]);

  function onSubmit(values: HabitInput) {
    startTransition(async () => {
      const result = habit ? await updateHabit(values) : await createHabit(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors?.name?.[0]) {
          form.setError("name", { message: result.fieldErrors.name[0] });
        }
        return;
      }
      toast.success(habit ? "Habit updated" : "Habit created");
      onOpenChange(false);
    });
  }

  const frequency = form.watch("frequency");
  const selectedColor = form.watch("color");
  const selectedIcon = form.watch("icon");
  const weekdays = form.watch("weekdays");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>Define what you want to do and how often.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Read 20 minutes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAILY">Every day</SelectItem>
                        <SelectItem value="WEEKLY">Weekly target</SelectItem>
                        <SelectItem value="CUSTOM">Specific days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetPerPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {frequency === "WEEKLY" ? "Times per week" : "Times per day"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(Math.max(1, Number(event.target.value) || 1))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {frequency === "CUSTOM" ? (
              <FormField
                control={form.control}
                name="weekdays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>On days</FormLabel>
                    <div className="flex flex-wrap gap-1">
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const active = weekdays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                active
                                  ? weekdays.filter((value) => value !== day)
                                  : [...weekdays, day],
                              )
                            }
                            className={cn(
                              "size-9 rounded-md border text-xs font-medium",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-accent/60",
                            )}
                          >
                            {weekdayShort(day).slice(0, 2)}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. pages, glasses" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lifeAreaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Life area</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {lifeAreas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "size-7 rounded-full border-2",
                          selectedColor === color ? "border-foreground" : "border-transparent",
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="grid grid-cols-10 gap-1">
                    {ICON_NAMES.map((name) => {
                      const Icon = resolveIcon(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-label={name}
                          onClick={() => field.onChange(name)}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-md border",
                            selectedIcon === name
                              ? "border-foreground bg-accent"
                              : "border-transparent hover:bg-accent/60",
                          )}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {habit ? "Save changes" : "Create habit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
