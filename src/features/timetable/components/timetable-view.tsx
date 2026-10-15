"use client";

import { formatMinutes } from "@/lib/dates";
import { effectiveWorkingWeekdays, type ScheduleConfig as WorkingScheduleConfig } from "@/lib/working-days";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";

import { TemplateFormDialog } from "./template-form-dialog";
import { BlockFormDialog } from "./block-form-dialog";
import { setDefaultTemplate, deleteTemplate } from "@/features/timetable/actions";
import type { TimetableTemplateSummary, TimetableBlock, WeekdayAssignment, PickerOption } from "@/features/timetable/queries";

interface TimetableViewProps {
  templates: TimetableTemplateSummary[];
  assignments: WeekdayAssignment[];
  scheduleConfig: WorkingScheduleConfig & { dayStartMinutes?: number; dayEndMinutes?: number };
  today: string;
  lifeAreas: PickerOption[];
  taskOptions: PickerOption[];
}

function TimeGrid({
  templates,
  assignments,
  scheduleConfig,
  workingWeekdays,
}: {
  templates: TimetableTemplateSummary[];
  assignments: WeekdayAssignment[];
  scheduleConfig: WorkingScheduleConfig & { dayStartMinutes?: number; dayEndMinutes?: number };
  workingWeekdays: number[];
}) {
  const dayStart = scheduleConfig.dayStartMinutes ?? 480;
  const dayEnd = scheduleConfig.dayEndMinutes ?? 1080;

  const getBlocksForDay = (dayOfWeek: number) => {
    const assignment = assignments.find((a) => a.dayOfWeek === dayOfWeek);
    if (!assignment?.templateId) return [];
    const template = templates.find((t) => t.id === assignment.templateId);
    return template?.blocks ?? [];
  };

  const getDayLabel = (dayOfWeek: number) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[dayOfWeek];
  };

  const isDayWorking = (dayOfWeek: number) => workingWeekdays.includes(dayOfWeek);

  const rows = useMemo(() => {
    const result = [];
    for (let m = dayStart; m < dayEnd; m += 30) {
      result.push(m);
    }
    return result;
  }, [dayStart, dayEnd]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]" role="grid">
        <thead>
          <tr className="border-b border-border/60">
            <th className="w-32 text-left text-xs font-medium text-muted-foreground p-2">Time</th>
            {workingWeekdays.map((day) => (
              <th key={day} className="w-64 text-center text-xs font-medium text-muted-foreground p-2">
                <div className={cn("flex flex-col items-center gap-1", !isDayWorking(day) && "opacity-50")}>
                  <span>{getDayLabel(day)}</span>
                  <Badge variant="outline" className="text-xs">
                    {assignments[day]?.templateId ? "Assigned" : "None"}
                  </Badge>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((minutes) => (
            <tr key={minutes} className="border-b border-border/30">
              <td className="w-32 text-right text-xs text-muted-foreground px-2 py-1">
                {formatMinutes(minutes)}
              </td>
              {workingWeekdays.map((day) => {
                const blocks = getBlocksForDay(day);
                const currentBlocks = blocks.filter(
                  (b) => b.startMinutes <= minutes && b.endMinutes > minutes
                );
                return (
                  <td key={day} className={cn("w-64 p-1 relative", !isDayWorking(day) && "bg-muted/30")}>
                    {currentBlocks.map((block) => (
                      <div
                        key={block.id}
                        className={cn(
                          "absolute inset-0 rounded border p-1.5 text-xs overflow-hidden transition-all",
                          "bg-card border-border/60 shadow-sm",
                          block.color && `border-l-3`,
                          block.color && `[border-left-color:${block.color}]`
                        )}
                        style={{
                          top: `${((block.startMinutes - dayStart) / (dayEnd - dayStart)) * 100}%`,
                          height: `${((block.endMinutes - block.startMinutes) / (dayEnd - dayStart)) * 100}%`,
                          position: "absolute",
                          zIndex: block.order + 1,
                        }}
                      >
                        <div className="font-medium truncate">{block.title}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatMinutes(block.startMinutes)} - {formatMinutes(block.endMinutes)}
                        </div>
                        {block.lifeArea && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: block.lifeArea.color }} />
                            {block.lifeArea.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TimetableView({
  templates,
  assignments,
  scheduleConfig,
  today,
  lifeAreas,
  taskOptions,
}: TimetableViewProps) {
  const [editingTemplate, setEditingTemplate] = useState<TimetableTemplateSummary | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimetableBlock | null>(null);
  const [editingBlockTemplateId, setEditingBlockTemplateId] = useState<string | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [isPending, startTransition] = useTransition();

  const workingWeekdays = effectiveWorkingWeekdays(today, 1, scheduleConfig);

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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground text-sm">
            Weekly schedule with reusable templates
          </p>
        </div>
        <Button onClick={() => { setCreatingTemplate(true); setEditingTemplate(null); }} className="gap-1">
          <Plus className="size-4" />
          New template
        </Button>
      </div>

      <TimeGrid
        templates={templates}
        assignments={assignments}
        scheduleConfig={scheduleConfig}
        workingWeekdays={workingWeekdays}
      />

      <div className="border-t border-border/60 pt-4">
        <h2 className="text-lg font-medium mb-3">Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={cn(template.isDefault && "ring-2 ring-primary")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">{template.dayType}</p>
                    {template.isDefault && <Badge variant="secondary" className="mt-1 text-xs">Default</Badge>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => { setEditingTemplate(template); setCreatingTemplate(false); }}>
                        <Pencil className="size-4" /> Edit
                      </DropdownMenuItem>
                      {!template.isDefault && (
                        <DropdownMenuItem onSelect={() => run(() => setDefaultTemplate(template.id), "Default set")}>
                          Set as default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => run(() => deleteTemplate(template.id), "Deleted")}>
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {template.blocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border border-border/60 hover:bg-accent cursor-pointer",
                      block.color && "border-l-3",
                      block.color && `[border-left-color:${block.color}]`
                    )}
                    onClick={() => { setEditingBlock(block); setEditingBlockTemplateId(template.id); }}
                  >
                    <GripVertical className="text-muted-foreground size-4" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{block.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMinutes(block.startMinutes)} - {formatMinutes(block.endMinutes)}
                      </div>
                    </div>
                    {block.lifeArea && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted"
                        style={{ backgroundColor: `${block.lifeArea.color}20` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: block.lifeArea.color }} />
                        {block.lifeArea.name}
                      </span>
                    )}
                  </div>
                ))}
                {template.blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No blocks yet</p>
                )}
                <Button variant="outline" size="sm" className="w-full gap-1"
                  onClick={() => { setIsAddingBlock(true); setEditingBlockTemplateId(template.id); setCreatingTemplate(false); }}>
                  <Plus className="size-3.5" /> Add block
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <TemplateFormDialog
        template={editingTemplate}
        open={editingTemplate != null || creatingTemplate}
        onOpenChange={(open) => { if (!open) { setEditingTemplate(null); setCreatingTemplate(false); } }}
      />

      <BlockFormDialog
        block={editingBlock}
        templateId={editingBlockTemplateId}
        open={editingBlock != null || isAddingBlock}
        onOpenChange={(open) => { 
          if (!open) { 
            setEditingBlock(null); 
            setEditingBlockTemplateId(null); 
            setIsAddingBlock(false); 
          } 
        }}
        editingBlockTemplateId={editingBlockTemplateId}
        isAddingBlock={isAddingBlock}
        lifeAreas={lifeAreas}
        taskOptions={taskOptions}
      />
    </div>
  );
}
