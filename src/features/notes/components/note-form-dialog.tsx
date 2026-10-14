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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createNote, updateNote } from "@/features/notes/actions";
import { type NoteInput, noteInputSchema } from "@/features/notes/schemas";
import type { NoteSummary } from "@/features/notes/queries";
import type { PickerOption } from "@/features/tasks/queries";

export function NoteFormDialog({
  open,
  onOpenChange,
  note,
  lifeAreas,
  projects,
  tags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: NoteSummary | null;
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  tags: PickerOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<NoteInput>({
    resolver: zodResolver(noteInputSchema),
    defaultValues: {
      title: "",
      body: "",
      format: "MARKDOWN",
      pinned: false,
      archived: false,
      lifeAreaId: null,
      projectId: null,
      tagIds: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (note) {
      form.reset({
        id: note.id,
        title: note.title,
        body: note.body,
        format: note.format as NoteInput["format"],
        pinned: note.pinned,
        archived: note.archived,
        lifeAreaId: note.lifeArea?.id ?? null,
        projectId: note.project?.id ?? null,
        tagIds: note.tags.map((tag) => tag.id),
      });
    } else {
      form.reset({
        title: "",
        body: "",
        format: "MARKDOWN",
        pinned: false,
        archived: false,
        lifeAreaId: null,
        projectId: null,
        tagIds: [],
      });
    }
  }, [open, note, form]);

  function onSubmit(values: NoteInput) {
    startTransition(async () => {
      const result = note ? await updateNote(values) : await createNote(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors?.title?.[0]) {
          form.setError("title", { message: result.fieldErrors.title[0] });
        }
        return;
      }
      toast.success(note ? "Note updated" : "Note created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle>
          <DialogDescription>Capture an idea, reference or piece of writing.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Note title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea rows={12} placeholder="Write something…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Format</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MARKDOWN">Markdown</SelectItem>
                        <SelectItem value="PLAIN">Plain text</SelectItem>
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
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
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
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {tags.length > 0 ? (
              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => {
                        const active = field.value.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              field.onChange(
                                active
                                  ? field.value.filter((id) => id !== tag.id)
                                  : [...field.value, tag.id],
                              )
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium",
                              active
                                ? "border-transparent text-white"
                                : "text-muted-foreground hover:bg-accent/60",
                            )}
                            style={active ? { backgroundColor: tag.color ?? "#64748b" } : undefined}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="pinned"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="note-pinned">Pin this note</Label>
                      <p className="text-muted-foreground text-xs">
                        Pinned notes stay at the top of your list.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        id="note-pinned"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {note ? "Save changes" : "Create note"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
