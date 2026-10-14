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
  utcToDateOnly,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  clearable = true,
}: {
  value: DateOnly | null;
  onChange: (value: DateOnly | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
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
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(date ? utcToDateOnly(date) : null);
              setOpen(false);
            }}
            autoFocus
          />
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
