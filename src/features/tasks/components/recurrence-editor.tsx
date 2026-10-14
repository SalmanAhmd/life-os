"use client";

import { formatRecurrence } from "@/lib/recurrence";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type DateOnly, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { RecurrenceInput } from "@/features/tasks/schemas";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function emptyRecurrenceInput(startDate: DateOnly): RecurrenceInput {
  return {
    frequency: "WEEKLY",
    interval: 1,
    byWeekday: [],
    byMonthDay: null,
    bySetPos: null,
    byWeekdayForSetPos: null,
    byMonth: null,
    startDate,
    endDate: null,
    count: null,
    exclusions: [],
  };
}

export function RecurrenceEditor({
  enabled,
  onEnabledChange,
  value,
  onChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: RecurrenceInput;
  onChange: (value: RecurrenceInput) => void;
}) {
  function update(patch: Partial<RecurrenceInput>) {
    onChange({ ...value, ...patch });
  }

  const endMode = value.count != null ? "count" : value.endDate != null ? "date" : "never";

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <Label htmlFor="recurring">Repeats</Label>
          <span className="text-muted-foreground text-xs">
            Turn a task into a recurring series.
          </span>
        </div>
        <Switch id="recurring" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Frequency</Label>
              <Select
                value={value.frequency}
                onValueChange={(next) =>
                  update({
                    frequency: next as RecurrenceInput["frequency"],
                    byWeekday: [],
                    byMonthDay: null,
                    bySetPos: null,
                    byWeekdayForSetPos: null,
                    byMonth: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interval">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  max={365}
                  value={value.interval}
                  onChange={(event) =>
                    update({ interval: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
                <span className="text-muted-foreground text-sm">
                  {value.frequency === "DAILY"
                    ? "day(s)"
                    : value.frequency === "WEEKLY"
                      ? "week(s)"
                      : value.frequency === "MONTHLY"
                        ? "month(s)"
                        : "year(s)"}
                </span>
              </div>
            </div>
          </div>

          {value.frequency === "WEEKLY" ? (
            <div className="flex flex-col gap-1.5">
              <Label>On days</Label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((day) => {
                  const active = value.byWeekday.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        update({
                          byWeekday: active
                            ? value.byWeekday.filter((d) => d !== day)
                            : [...value.byWeekday, day],
                        })
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
              <span className="text-muted-foreground text-xs">
                Leave empty to use the start date&apos;s weekday.
              </span>
            </div>
          ) : null}

          {value.frequency === "MONTHLY" ? (
            <div className="flex flex-col gap-2">
              <Label>Pattern</Label>
              <Select
                value={value.bySetPos != null ? "nth" : "day"}
                onValueChange={(mode) =>
                  mode === "nth"
                    ? update({
                        byMonthDay: null,
                        bySetPos: 1,
                        byWeekdayForSetPos: 1,
                      })
                    : update({ bySetPos: null, byWeekdayForSetPos: null, byMonthDay: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">On a day of the month</SelectItem>
                  <SelectItem value="nth">On the nth weekday</SelectItem>
                </SelectContent>
              </Select>
              {value.bySetPos != null ? (
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={String(value.bySetPos)}
                    onValueChange={(next) =>
                      update({ bySetPos: Number(next) as RecurrenceInput["bySetPos"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">First</SelectItem>
                      <SelectItem value="2">Second</SelectItem>
                      <SelectItem value="3">Third</SelectItem>
                      <SelectItem value="4">Fourth</SelectItem>
                      <SelectItem value="-1">Last</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(value.byWeekdayForSetPos ?? 1)}
                    onValueChange={(next) => update({ byWeekdayForSetPos: Number(next) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {weekdayShort(day)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={value.byMonthDay ?? 1}
                  onChange={(event) =>
                    update({ byMonthDay: Math.min(31, Math.max(1, Number(event.target.value) || 1)) })
                  }
                />
              )}
            </div>
          ) : null}

          {value.frequency === "YEARLY" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Month</Label>
              <Select
                value={String(value.byMonth ?? 1)}
                onValueChange={(next) => update({ byMonth: Number(next) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {MONTH_LABELS[month - 1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Starts</Label>
              <DatePicker
                value={value.startDate}
                clearable={false}
                onChange={(date) => date && update({ startDate: date })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ends</Label>
              <Select
                value={endMode}
                onValueChange={(mode) =>
                  mode === "never"
                    ? update({ endDate: null, count: null })
                    : mode === "date"
                      ? update({ count: null, endDate: value.startDate })
                      : update({ endDate: null, count: 10 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="date">On a date</SelectItem>
                  <SelectItem value="count">After a number of times</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {endMode === "date" ? (
            <DatePicker
              value={value.endDate ?? null}
              clearable={false}
              onChange={(date) => date && update({ endDate: date })}
            />
          ) : null}
          {endMode === "count" ? (
            <Input
              type="number"
              min={1}
              max={1000}
              value={value.count ?? 1}
              onChange={(event) =>
                update({ count: Math.max(1, Number(event.target.value) || 1) })
              }
            />
          ) : null}

          <p className="bg-muted rounded-md px-3 py-2 text-sm">
            {formatRecurrence({
              ...value,
              byWeekday: value.byWeekday,
              byMonthDay: value.byMonthDay ?? null,
              bySetPos: value.bySetPos ?? null,
              byWeekdayForSetPos: value.byWeekdayForSetPos ?? null,
              byMonth: value.byMonth ?? null,
              endDate: value.endDate ?? null,
              count: value.count ?? null,
            })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
