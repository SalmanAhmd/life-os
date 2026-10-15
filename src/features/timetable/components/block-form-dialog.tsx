"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
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
import { addBlock, updateBlock, deleteBlock } from "@/features/timetable/actions";
import { blockInputSchema, type BlockInput } from "@/features/timetable/schemas";
import { cn } from "@/lib/utils";

interface BlockFormDialogProps {
  block: TimetableBlock | null;
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifeAreas: PickerOption[];
  taskOptions: PickerOption[];
  isAddingBlock?: boolean
  editingBlockTemplateId: string | null;
}

interface TimetableBlock {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  category: string | null;
  color: string | null;
  startMinutes: number;
  endMinutes: number;
  order: number;
  isRecurring: boolean;
  taskId: string | null;
  lifeAreaId: string | null;
  task: { id: string; title: string } | null;
  lifeArea: { id: string; name: string; color: string } | null;
}

interface PickerOption {
  id: string;
  name: string;
  color?: string | null;
}

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

export function BlockFormDialog({ block, templateId, open, onOpenChange, lifeAreas, taskOptions, isAddingBlock,editingBlockTemplateId }: BlockFormDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<BlockInput>({
    resolver: zodResolver(blockInputSchema),
    defaultValues: block
      ? {
        id: block.id,
        templateId: templateId ?? block.templateId,
        title: block.title,
        description: block.description ?? "",
        category: block.category ?? "",
        color: block.color ?? "",
        start: formatMinutesToTime(block.startMinutes),
        end: formatMinutesToTime(block.endMinutes),
        taskId: block.taskId ?? "",
        lifeAreaId: block.lifeAreaId ?? "",
      }
      : { templateId: templateId ?? "", title: "New block", description: "", category: "", color: "", start: "09:00", end: "10:00", taskId: "", lifeAreaId: "" },
  });

  function onSubmit(data: BlockInput) {
    startTransition(async () => {
      const result = isAddingBlock ? await addBlock({
        ...data,
        templateId: editingBlockTemplateId ?? data.templateId
      }) : await updateBlock({ ...data, id: block?.id });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save block");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof BlockInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      toast.success(isAddingBlock ? "Block added" : "Block updated");
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!block && !isAddingBlock) return;
    startTransition(async () => {
      const result = isAddingBlock ? { ok: true } : await deleteBlock(block!.id);
      if (!result.ok) {
        toast.error(isAddingBlock ? "Block discarded" : "Failed to delete block");
        return;
      }
      toast.success(isAddingBlock ? "Block discarded" : "Block deleted");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAddingBlock ? "Add block" : block ? "Edit block" : "Add block"}</DialogTitle>
          <DialogDescription>
            {isAddingBlock ? "Create a new time block in the template" : block ? "Update this time block" : "Create a new time block in the template"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <input type="hidden" {...field} />
              )}
            />
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
                          field.value === color ? "border-primary scale-110" : "border-transparent hover:border-muted-foreground/50"
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
              name="taskId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link task (optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a task" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {taskOptions.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}
                        </SelectItem>
                      ))}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a life area" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lifeAreas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color ?? "#6366f1" }} />
                            {area.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className={cn(block && "justify-between")}>
              {block && (
                <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                  Delete
                </Button>
              )}
              <div className={cn(block && "flex-1 flex justify-end")}>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="ml-2">
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
