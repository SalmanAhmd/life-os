"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type DateOnly,
  dateOnlyToUtc,
  formatDateOnly,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  clearable = false,
  showMonthYear = false,
}: {
  value: DateOnly | null;
  onChange: (value: DateOnly | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  showMonthYear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? dateOnlyToUtc(value) : undefined;

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-4" />
            {value ? formatDateOnly(value, { withYear: true }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {(
            <div className="p-2 border-b border-border/60 flex items-center justify-between">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(date) => {
                  // Use local getters since the Date object from DayPicker
                  // already represents the selected day in the user's local timezone
                  if (!date) return;
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, "0");
                  const day = String(date.getDate()).padStart(2, "0");
                  onChange(`${year}-${month}-${day}`);
                  setOpen(false);
                }}
                autoFocus
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear date"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
