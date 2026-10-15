"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Clock, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BlockFormDialog } from "./block-form-dialog";
import { deleteBlock } from "@/features/timetable/actions";
import { ALL_DAYS } from "@/features/timetable/schemas";
import type { PickerOption, TimetableBlock } from "@/features/timetable/queries";
import { formatMinutes } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface TimetableViewProps {
  blocks: TimetableBlock[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  lifeAreas: PickerOption[];
  taskOptions: PickerOption[];
}

const PX_PER_MIN = 0.75;
const TIME_GUTTER_WIDTH = 56;

const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

interface LaidOutBlock {
  block: TimetableBlock;
  col: number;
  cols: number;
}

function layoutDay(blocks: TimetableBlock[]): LaidOutBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );
  const result: LaidOutBlock[] = [];
  let cluster: TimetableBlock[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const colEnds: number[] = [];
    const assigned = cluster.map((block) => {
      let col = colEnds.findIndex((end) => end <= block.startMinutes);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(block.endMinutes);
      } else {
        colEnds[col] = block.endMinutes;
      }
      return { block, col };
    });
    const cols = colEnds.length;
    for (const entry of assigned) result.push({ ...entry, cols });
    cluster = [];
  };

  for (const block of sorted) {
    if (cluster.length > 0 && block.startMinutes >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(block);
    clusterEnd = Math.max(clusterEnd, block.endMinutes);
  }
  flush();

  return result;
}

function BlockCard({
  block,
  rangeStart,
  col,
  cols,
  onEdit,
  onDelete,
}: {
  block: TimetableBlock;
  rangeStart: number;
  col: number;
  cols: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = block.color || block.lifeArea?.color || "#6366f1";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onEdit();
      }}
      className="group absolute rounded-md border border-border/60 bg-card p-1.5 text-left shadow-sm transition-colors hover:ring-1 hover:ring-primary/40 cursor-pointer overflow-hidden"
      style={{
        top: (block.startMinutes - rangeStart) * PX_PER_MIN,
        height: Math.max((block.endMinutes - block.startMinutes) * PX_PER_MIN - 2, 22),
        left: `calc(${(col / cols) * 100}% + 2px)`,
        width: `calc(${100 / cols}% - 4px)`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium leading-tight">{block.title}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatMinutes(block.startMinutes)} – {formatMinutes(block.endMinutes)}
          </div>
          {block.task && (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {block.task.title}
            </div>
          )}
          {block.lifeArea && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: block.lifeArea.color }}
              />
              <span className="truncate">{block.lifeArea.name}</span>
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              aria-label="Block actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDelete()}>
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function TimetableView({
  blocks,
  dayStartMinutes,
  dayEndMinutes,
  lifeAreas,
  taskOptions,
}: TimetableViewProps) {
  const [editingBlock, setEditingBlock] = useState<TimetableBlock | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultDays, setDefaultDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [, startTransition] = useTransition();

  const { rangeStart, rangeEnd } = useMemo(() => {
    const earliest = blocks.length
      ? Math.min(...blocks.map((b) => b.startMinutes))
      : dayStartMinutes;
    const latest = blocks.length
      ? Math.max(...blocks.map((b) => b.endMinutes))
      : dayEndMinutes;
    return {
      rangeStart: Math.floor(Math.min(dayStartMinutes, earliest) / 60) * 60,
      rangeEnd: Math.ceil(Math.max(dayEndMinutes, latest) / 60) * 60,
    };
  }, [blocks, dayStartMinutes, dayEndMinutes]);

  const totalMinutes = Math.max(rangeEnd - rangeStart, 60);
  const gridHeight = totalMinutes * PX_PER_MIN;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) list.push(m);
    return list;
  }, [rangeStart, rangeEnd]);

  const blocksByDay = useMemo(() => {
    const map = new Map<number, TimetableBlock[]>();
    for (const day of ALL_DAYS) map.set(day, []);
    for (const block of blocks) {
      for (const day of block.days) {
        if (map.has(day)) map.get(day)!.push(block);
      }
    }
    return map;
  }, [blocks]);

  function openAdd(day?: number) {
    setEditingBlock(null);
    setDefaultDays(day == null ? [1, 2, 3, 4, 5] : [day]);
    setDialogOpen(true);
  }

  function openEdit(block: TimetableBlock) {
    setEditingBlock(block);
    setDialogOpen(true);
  }

  function handleDelete(block: TimetableBlock) {
    startTransition(async () => {
      const result = await deleteBlock(block.id);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete block");
        return;
      }
      toast.success("Block deleted");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground text-sm">
            Your weekly schedule — weekdays and weekend
          </p>
        </div>
        <Button onClick={() => openAdd()} className="gap-1">
          <Plus className="size-4" />
          Add block
        </Button>
      </div>

      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-12 text-center">
          <Clock className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">No blocks yet</p>
          <p className="text-xs text-muted-foreground">
            Add a block to plan your weekdays or a specific day.
          </p>
          <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={() => openAdd()}>
            <Plus className="size-3.5" /> Add block
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <div className="min-w-[880px]">
          {/* Header row */}
          <div
            className="grid border-b border-border/60 bg-muted/30"
            style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))` }}
          >
            <div className="p-2" />
            {ALL_DAYS.map((day) => {
              const weekend = day === 0 || day === 6;
              return (
                <div
                  key={day}
                  className={cn(
                    "flex items-center justify-between gap-1 border-l border-border/60 p-2",
                    weekend && "bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{DAY_LABELS[day]}</span>
                    {weekend && (
                      <Badge variant="outline" className="px-1 py-0 text-[10px]">
                        Weekend
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openAdd(day)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent"
                    aria-label={`Add block on ${DAY_LABELS[day]}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `${TIME_GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))` }}
          >
            {/* Time gutter */}
            <div className="relative" style={{ height: gridHeight }}>
              {hours.map((minutes) => (
                <div
                  key={minutes}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: (minutes - rangeStart) * PX_PER_MIN }}
                >
                  {formatMinutes(minutes)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {ALL_DAYS.map((day) => {
              const weekend = day === 0 || day === 6;
              const laid = layoutDay(blocksByDay.get(day) ?? []);
              return (
                <div
                  key={day}
                  className={cn(
                    "relative border-l border-border/60",
                    weekend && "bg-muted/20",
                  )}
                  style={{ height: gridHeight }}
                >
                  {hours.map((minutes) => (
                    <div
                      key={minutes}
                      className="absolute inset-x-0 border-t border-border/20"
                      style={{ top: (minutes - rangeStart) * PX_PER_MIN }}
                    />
                  ))}
                  {laid.map(({ block, col, cols }) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      rangeStart={rangeStart}
                      col={col}
                      cols={cols}
                      onEdit={() => openEdit(block)}
                      onDelete={() => handleDelete(block)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BlockFormDialog
        block={editingBlock}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingBlock(null);
        }}
        defaultDays={defaultDays}
        lifeAreas={lifeAreas}
        taskOptions={taskOptions}
      />
    </div>
  );
}
