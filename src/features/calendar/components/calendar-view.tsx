"use client";

import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  type DateOnly,
  addDays,
  addMonths,
  dayOfMonth,
  eachDay,
  endOfMonth,
  endOfWeek,
  formatDateOnly,
  formatDateOnlyLong,
  formatInstant,
  formatMinutes,
  localDateOnly,
  monthName,
  monthOf,
  parseTimeToMinutes,
  startOfMonth,
  startOfWeek,
  weekdayOf,
  weekdayShort,
  yearOf,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { fetchCalendarItems } from "@/features/calendar/actions";
import { EventFormDialog } from "@/features/calendar/components/event-form-dialog";
import type { CalendarItem } from "@/features/calendar/queries";
import type { PickerOption } from "@/features/tasks/queries";

type CalendarMode = "month" | "week" | "day" | "agenda";

const WEEK_STARTS_ON = 0;

const MODES: { value: CalendarMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

function rangeFor(mode: CalendarMode, cursor: DateOnly): { from: DateOnly; to: DateOnly } {
  switch (mode) {
    case "month":
      return {
        from: startOfWeek(startOfMonth(cursor), WEEK_STARTS_ON),
        to: endOfWeek(endOfMonth(cursor), WEEK_STARTS_ON),
      };
    case "week": {
      const from = startOfWeek(cursor, WEEK_STARTS_ON);
      return { from, to: addDays(from, 6) };
    }
    case "day":
      return { from: cursor, to: cursor };
    case "agenda":
      return { from: cursor, to: addDays(cursor, 30) };
  }
}

function itemDate(item: CalendarItem, timezone: string): DateOnly | null {
  if (item.dateOnly) return item.dateOnly;
  if (item.start) return localDateOnly(new Date(item.start), timezone);
  return null;
}

function itemMinutes(item: CalendarItem, timezone: string): number {
  if (item.allDay || !item.start) return -1;
  return parseTimeToMinutes(formatInstant(new Date(item.start), timezone, "HH:mm")) ?? 0;
}

function compareItems(a: CalendarItem, b: CalendarItem, timezone: string): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return itemMinutes(a, timezone) - itemMinutes(b, timezone);
}

function startTimeLabel(item: CalendarItem, timezone: string): string | null {
  if (item.allDay || !item.start) return null;
  return formatInstant(new Date(item.start), timezone, "HH:mm");
}

export function CalendarView({
  items: initialItems,
  lifeAreas,
  timezone,
  today,
}: {
  items: CalendarItem[];
  lifeAreas: PickerOption[];
  timezone: string;
  today: DateOnly;
}) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState<DateOnly>(today);
  const [items, setItems] = useState<CalendarItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState({
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    allDay: false,
  });

  // The active range's items are server-rendered for the initial month range,
  // then fetched on demand. We track the range the *currently held* `items`
  // belong to (rather than a set of "already fetched" ranges) so switching back
  // to a previously visited tab reloads its data instead of leaving the other
  // tab's items on screen.
  const initialRange = rangeFor("month", today);
  const loadedRangeRef = useRef(`${initialRange.from}:${initialRange.to}`);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const { from, to } = rangeFor(mode, cursor);
    const key = `${from}:${to}`;
    if (key === loadedRangeRef.current) return;

    const requestId = ++requestIdRef.current;
    startTransition(async () => {
      const result = await fetchCalendarItems(from, to);
      // A newer range was requested while this one was in flight — drop it.
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      loadedRangeRef.current = key;
      setItems(result.data);
    });
  }, [mode, cursor]);

  const itemsByDate = useMemo(() => {
    const map = new Map<DateOnly, CalendarItem[]>();
    for (const item of items) {
      const date = itemDate(item, timezone);
      if (!date) continue;
      const list = map.get(date);
      if (list) list.push(item);
      else map.set(date, [item]);
    }
    for (const list of map.values()) list.sort((a, b) => compareItems(a, b, timezone));
    return map;
  }, [items, timezone]);

  const monthDays = useMemo(() => {
    const { from, to } = rangeFor("month", cursor);
    return eachDay(from, to);
  }, [cursor]);
  const weekDays = useMemo(() => {
    const { from, to } = rangeFor("week", cursor);
    return eachDay(from, to);
  }, [cursor]);
  const agendaDays = useMemo(() => {
    const { from, to } = rangeFor("agenda", cursor);
    return eachDay(from, to);
  }, [cursor]);

  function navigate(direction: number) {
    setCursor((current) => {
      switch (mode) {
        case "month":
          return addMonths(current, direction);
        case "week":
          return addDays(current, direction * 7);
        case "agenda":
          return addDays(current, direction * 30);
        case "day":
        default:
          return addDays(current, direction);
      }
    });
  }

  function openCreate(date: DateOnly, time?: string) {
    const startMinutes = time ? (parseTimeToMinutes(time) ?? 540) : 540;
    setEditingId(null);
    setDefaults({
      date,
      startTime: formatMinutes(startMinutes),
      endTime: formatMinutes(startMinutes + 60),
      allDay: false,
    });
    setDialogOpen(true);
  }

  function openEdit(item: CalendarItem) {
    setEditingId(item.eventSeriesId ?? item.id);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(today)}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 flex items-center gap-2 text-lg font-semibold">
            {titleFor(mode, cursor)}
            {isPending ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg p-1 text-sm">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  mode === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button onClick={() => openCreate(cursor)} className="gap-1">
            <Plus className="size-4" />
            New event
          </Button>
        </div>
      </div>

      {mode === "month" ? (
        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted/40 grid grid-cols-7 border-b">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="text-muted-foreground px-2 py-1.5 text-center text-xs font-medium"
              >
                {weekdayShort((WEEK_STARTS_ON + index) % 7)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => (
              <MonthCell
                key={day}
                day={day}
                cursor={cursor}
                today={today}
                timezone={timezone}
                items={itemsByDate.get(day) ?? []}
                onCreate={openCreate}
                onEdit={openEdit}
              />
            ))}
          </div>
        </div>
      ) : null}

      {mode === "week" ? (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openCreate(day)}
                className={cn(
                  "hover:bg-accent/50 rounded-md border px-2 py-1.5 text-center",
                  day === today && "border-primary",
                )}
              >
                <div className="text-muted-foreground text-xs">{weekdayShort(weekdayOf(day))}</div>
                <div className="text-sm font-medium">{dayOfMonth(day)}</div>
              </button>
              <div className="flex min-h-40 flex-col gap-1">
                {(itemsByDate.get(day) ?? []).map((item) => (
                  <ItemChip
                    key={item.id}
                    item={item}
                    timezone={timezone}
                    variant="block"
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {mode === "day" ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openCreate(cursor)}
            className="border-border/60 text-muted-foreground hover:bg-accent/40 rounded-lg border border-dashed px-4 py-2 text-left text-sm"
          >
            Add an event on {formatDateOnly(cursor, { withYear: true })}
          </button>
          {(itemsByDate.get(cursor) ?? []).length === 0 ? (
            <EmptyState onAdd={() => openCreate(cursor)} />
          ) : (
            (itemsByDate.get(cursor) ?? []).map((item) => (
              <ItemChip
                key={item.id}
                item={item}
                timezone={timezone}
                variant="row"
                onEdit={openEdit}
              />
            ))
          )}
        </div>
      ) : null}

      {mode === "agenda" ? (
        <div className="flex flex-col gap-4">
          {agendaDays.every((day) => (itemsByDate.get(day) ?? []).length === 0) ? (
            <EmptyState onAdd={() => openCreate(cursor)} />
          ) : (
            agendaDays.map((day) => {
              const dayItems = itemsByDate.get(day) ?? [];
              if (dayItems.length === 0) return null;
              return (
                <div key={day} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => openCreate(day)}
                    className="text-muted-foreground hover:text-foreground text-left text-sm font-medium"
                  >
                    {formatDateOnly(day, { withYear: true })}
                  </button>
                  {dayItems.map((item) => (
                    <ItemChip
                      key={item.id}
                      item={item}
                      timezone={timezone}
                      variant="row"
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={editingId}
        defaultDate={defaults.date}
        defaultStartTime={defaults.startTime}
        defaultEndTime={defaults.endTime}
        defaultAllDay={defaults.allDay}
        lifeAreas={lifeAreas}
        today={today}
      />
    </div>
  );
}

function titleFor(mode: CalendarMode, cursor: DateOnly): string {
  switch (mode) {
    case "month":
      return `${monthName(monthOf(cursor))} ${yearOf(cursor)}`;
    case "week": {
      const from = startOfWeek(cursor, WEEK_STARTS_ON);
      const to = addDays(from, 6);
      return `${formatDateOnly(from)} – ${formatDateOnly(to, { withYear: true })}`;
    }
    case "day":
      return formatDateOnlyLong(cursor);
    case "agenda":
      return `Next 30 days`;
  }
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
      <p className="font-medium">Nothing scheduled</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Your events and task dates will appear here.
      </p>
      <Button onClick={onAdd} variant="outline" className="mt-4 gap-1">
        <Plus className="size-4" />
        New event
      </Button>
    </div>
  );
}

function MonthCell({
  day,
  cursor,
  today,
  timezone,
  items,
  onCreate,
  onEdit,
}: {
  day: DateOnly;
  cursor: DateOnly;
  today: DateOnly;
  timezone: string;
  items: CalendarItem[];
  onCreate: (date: DateOnly) => void;
  onEdit: (item: CalendarItem) => void;
}) {
  const inMonth = monthOf(day) === monthOf(cursor) && yearOf(day) === yearOf(cursor);
  const visible = items.slice(0, 3);
  const hidden = items.length - visible.length;

  return (
    <div
      onClick={() => onCreate(day)}
      className={cn(
        "group hover:bg-accent/20 flex min-h-24 cursor-pointer flex-col gap-1 border-r border-b p-1.5",
        !inMonth && "bg-muted/20 text-muted-foreground",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-xs font-medium",
            day === today && "bg-primary text-primary-foreground",
          )}
        >
          {dayOfMonth(day)}
        </span>
        <span className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="size-3.5" />
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {visible.map((item) => (
          <ItemChip
            key={item.id}
            item={item}
            timezone={timezone}
            variant="compact"
            onEdit={onEdit}
          />
        ))}
        {hidden > 0 ? (
          <span className="text-muted-foreground px-1 text-[11px]">+{hidden} more</span>
        ) : null}
      </div>
    </div>
  );
}

function ItemChip({
  item,
  timezone,
  variant,
  onEdit,
}: {
  item: CalendarItem;
  timezone: string;
  variant: "compact" | "block" | "row";
  onEdit: (item: CalendarItem) => void;
}) {
  const color = item.color ?? (item.kind === "event" ? "#6366f1" : "#64748b");
  const start = startTimeLabel(item, timezone);
  const end =
    item.allDay || !item.end ? null : formatInstant(new Date(item.end), timezone, "HH:mm");

  const shared = cn(
    "flex w-full items-center gap-1.5 overflow-hidden rounded-md border-l-2 text-left text-xs",
    variant === "compact" ? "px-1.5 py-0.5" : "px-2.5 py-1.5 text-sm",
    item.kind === "task" && "border border-dashed",
  );

  const content = (
    <>
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {start && variant !== "compact" ? (
        <span className="text-muted-foreground shrink-0 tabular-nums">{start}</span>
      ) : null}
      <span className="truncate font-medium">{item.title}</span>
      {variant === "row" && end ? (
        <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">– {end}</span>
      ) : null}
      {item.recurrenceLabel && variant === "row" ? (
        <span className="text-muted-foreground ml-1 shrink-0">{item.recurrenceLabel}</span>
      ) : null}
    </>
  );

  if (item.kind === "task") {
    return (
      <Link
        href="/tasks"
        onClick={(event) => event.stopPropagation()}
        className={cn(shared, "bg-muted/40 hover:bg-muted")}
        style={{ borderLeftColor: color }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onEdit(item);
      }}
      className={cn(shared, "bg-card hover:bg-accent/60")}
      style={{ borderLeftColor: color }}
    >
      {content}
    </button>
  );
}
