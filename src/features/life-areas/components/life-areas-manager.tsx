"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Badge } from "@/components/ui/badge";
import { ICON_NAMES, resolveIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  archiveLifeArea,
  createLifeArea,
  deleteLifeArea,
  restoreLifeArea,
  updateLifeArea,
} from "@/features/life-areas/actions";
import { type LifeAreaInput, lifeAreaInputSchema } from "@/features/life-areas/schemas";
import type { LifeAreaSummary } from "@/features/life-areas/queries";

const COLOR_PRESETS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#a855f7",
];

export function LifeAreasManager({ areas }: { areas: LifeAreaSummary[] }) {
  const [editing, setEditing] = useState<LifeAreaSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(area: LifeAreaSummary) {
    setEditing(area);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New life area
        </Button>
      </div>

      {areas.length === 0 ? (
        <div className="border-border/60 bg-muted/30 rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No life areas yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create areas like Work, Health or Family to organise everything.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {areas.map((area) => (
            <LifeAreaRow
              key={area.id}
              area={area}
              onEdit={() => openEdit(area)}
            />
          ))}
        </ul>
      )}

      <LifeAreaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        area={editing}
      />
    </div>
  );
}

function LifeAreaRow({
  area,
  onEdit,
}: {
  area: LifeAreaSummary;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const Icon = resolveIcon(area.icon);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(success);
    });
  }

  return (
    <li className="border-border/70 bg-card flex items-center gap-3 rounded-md border px-3 py-2">
      <div
        className="flex size-8 items-center justify-center rounded-md"
        style={{ backgroundColor: `${area.color}22`, color: area.color }}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex flex-1 items-center gap-2">
        <span className="text-sm font-medium">{area.name}</span>
        {area.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
          <Pencil className="size-4" />
        </Button>
        {area.isArchived ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Restore"
            disabled={isPending}
            onClick={() => run(() => restoreLifeArea(area.id), "Life area restored")}
          >
            <ArchiveRestore className="size-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Archive"
            disabled={isPending}
            onClick={() => run(() => archiveLifeArea(area.id), "Life area archived")}
          >
            <Archive className="size-4" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{area.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Items keep their data but become unassigned from this life area.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => run(() => deleteLifeArea(area.id), "Life area deleted")}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

function LifeAreaDialog({
  open,
  onOpenChange,
  area,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: LifeAreaSummary | null;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<LifeAreaInput>({
    resolver: zodResolver(lifeAreaInputSchema),
    values: {
      id: area?.id,
      name: area?.name ?? "",
      color: area?.color ?? COLOR_PRESETS[0]!,
      icon: area?.icon ?? "circle",
    },
  });

  function onSubmit(values: LifeAreaInput) {
    startTransition(async () => {
      const result = area ? await updateLifeArea(values) : await createLifeArea(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors?.name?.[0]) {
          form.setError("name", { message: result.fieldErrors.name[0] });
        }
        return;
      }
      toast.success(area ? "Life area updated" : "Life area created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{area ? "Edit life area" : "New life area"}</DialogTitle>
          <DialogDescription>
            Give it a name, color and icon.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Health" {...field} />
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
                        aria-label={color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "size-7 rounded-full border-2",
                          field.value === color ? "border-foreground" : "border-transparent",
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
                            field.value === name
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
                {area ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
