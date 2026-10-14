"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Check, Calendar, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { updateSchedule } from "@/features/settings/actions";
import { scheduleInputSchema, type ScheduleInput } from "@/features/settings/schemas";
import { effectiveWorkingWeekdays, workingDayCountForMonth, isWorkingDay, type ScheduleConfig } from "@/lib/working-days";
import { todayDateOnly, monthName, yearOf, type DateOnly } from "@/lib/dates";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseJson<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return fallback;
  }
}

interface ScheduleFormProps {
  defaultValues: ScheduleInput;
}

export function ScheduleForm({ defaultValues }: ScheduleFormProps) {
  const [isPending, startTransition] = useTransition();
  const today = todayDateOnly("UTC");
  const year = yearOf(today);
  const month = Number(today.slice(5, 7));

  const form = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleInputSchema),
    defaultValues,
  });

  const holidayArray = useFieldArray({
    control: form.control,
    name: "holidays",
  });
  const { fields: holidayFields, append: appendHoliday, remove: removeHoliday } = holidayArray;

  const workdayArray = useFieldArray({
    control: form.control,
    // @ts-expect-error RHF useFieldArray type inference limitation with multiple arrays
    name: "exceptionalWorkdays",
  });
  const { fields: workdayFields, append: appendWorkday, remove: removeWorkday } = workdayArray;

  function onSubmit(data: ScheduleInput) {
    startTransition(async () => {
      const result = await updateSchedule(data);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update schedule");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof ScheduleInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      toast.success("Schedule updated");
    });
  }

  const config: ScheduleConfig = {
    saturdayRule: form.watch("saturdayRule"),
    workingDays: form.watch("workingDays"),
    alternateSaturdayWeeks: form.watch("alternateSaturdayWeeks"),
    alternateSaturdayAnchor: form.watch("alternateSaturdayAnchor"),
    holidays: parseJson(form.watch("holidays"), []),
    exceptionalWorkdays: parseJson(form.watch("exceptionalWorkdays"), []),
  };

  const workingWeekdays = effectiveWorkingWeekdays(today, 1, config);
  const workingCount = workingDayCountForMonth(year, month, config);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="saturdayRule"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Saturday rule</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rule" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ALL_OFF">All Saturdays off</SelectItem>
                    <SelectItem value="ALL_WORKING">All Saturdays working</SelectItem>
                    <SelectItem value="ALTERNATE_OFF">Alternate Saturdays off</SelectItem>
                    <SelectItem value="SECOND_FOURTH_OFF">2nd & 4th Saturdays off</SelectItem>
                    <SelectItem value="CUSTOM">Custom (use checkboxes)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="alternateSaturdayWeeks"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate interval (weeks)</FormLabel>
                <FormControl>
                  <Input type="number" min="2" max="52" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="alternateSaturdayAnchor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Anchor Saturday (for alternate rule)</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dayStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day starts</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dayEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day ends</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <fieldset className="border-border/60 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4">Working weekdays</legend>
          <div className="grid grid-cols-7 gap-2 text-center">
            {WEEKDAY_LABELS.map((label, idx) => (
              <FormField
                key={idx}
                control={form.control}
                name="workingDays"
                render={({ field }) => (
                  <FormItem className="m-0">
                    <FormControl>
                      <label className="flex flex-col items-center gap-1 cursor-pointer p-2 rounded-md hover:bg-accent">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <Checkbox
                          checked={field.value?.includes(idx)}
                          onCheckedChange={(checked) => {
                            const current = field.value ?? [];
                            if (checked) {
                              field.onChange([...current, idx].sort((a, b) => a - b));
                            } else {
                              field.onChange(current.filter((d) => d !== idx));
                            }
                          }}
                        />
                      </label>
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="border-border/60 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4 flex items-center justify-between">
            Holidays
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => appendHoliday({ date: today, name: "Holiday" })}
            >
              <Check className="size-3.5" /> Add
            </Button>
          </legend>
          <div className="space-y-2">
            {holidayFields.map((holiday, idx) => (
              <div key={holiday.id} className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name={`holidays.${idx}.date`}
                  render={({ field }) => (
                    <FormControl>
                      <Input type="date" {...field} className="w-36" />
                    </FormControl>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`holidays.${idx}.name`}
                  render={({ field }) => (
                    <FormControl>
                      <Input placeholder="Holiday name" {...field} className="flex-1" />
                    </FormControl>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeHoliday(idx)}
                  aria-label="Remove holiday"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-border/60 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4 flex items-center justify-between">
            Exceptional working days
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              // @ts-expect-error RHF useFieldArray type inference limitation
              onClick={() => appendWorkday(today)}
            >
              <Calendar className="size-3.5" /> Add
            </Button>
          </legend>
          <div className="space-y-2">
            {workdayFields.map((workday, idx) => (
              <div key={workday.id} className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name={`exceptionalWorkdays.${idx}`}
                  render={({ field }) => (
                    <FormControl>
                      <Input type="date" {...field} className="w-36" />
                    </FormControl>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeWorkday(idx)}
                  aria-label="Remove exceptional working day"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-border/60 bg-muted/30 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4">Preview — {monthName(month)} {year}</legend>
          <p className="text-sm text-muted-foreground mb-3">
            {workingCount} working days this month. Working weekdays:{' '}
            {workingWeekdays.map((d) => FULL_WEEKDAY_LABELS[d]).join(", ")}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-muted-foreground font-medium py-1">{label}</div>
            ))}
            {(() => {
              const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
              const adjusted = (firstDay - 1 + 7) % 7;
              const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
              const cells = [];
              for (let i = 0; i < adjusted; i++) cells.push(<div key={`empty-${i}`} className="py-1" />);
              for (let d = 1; d <= daysInMonth; d++) {
                const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const working = isWorkingDay(date as DateOnly, config);
                cells.push(
                  <div
                    key={d}
                    className={`py-1 rounded ${working ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                  >
                    {d}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </fieldset>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending}>
            Save schedule
          </Button>
        </div>
      </form>
    </Form>
  );
}