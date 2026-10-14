"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookHeart, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateOnly, relativeDayLabel, type DateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteJournalEntry, upsertJournalEntry } from "@/features/journal/actions";
import {
  type JournalEntryInput,
  journalEntryInputSchema,
} from "@/features/journal/schemas";
import type { JournalEntrySummary } from "@/features/journal/queries";
import type { PickerOption } from "@/features/tasks/queries";

const MOODS = [
  { value: "GREAT", label: "Great", color: "#10b981" },
  { value: "GOOD", label: "Good", color: "#22c55e" },
  { value: "OKAY", label: "Okay", color: "#eab308" },
  { value: "LOW", label: "Low", color: "#f97316" },
  { value: "BAD", label: "Bad", color: "#ef4444" },
] as const;

const MOOD_COLORS: Record<string, string> = Object.fromEntries(
  MOODS.map((mood) => [mood.value, mood.color]),
);

export function JournalView({
  initialDate,
  entries,
  tags,
}: {
  initialDate: DateOnly;
  entries: JournalEntrySummary[];
  tags: PickerOption[];
}) {
  const [selectedDate, setSelectedDate] = useState<DateOnly>(initialDate);
  const entry = entries.find((item) => item.date === selectedDate) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-3">
        <DatePicker
          value={selectedDate}
          clearable={false}
          onChange={(date) => date && setSelectedDate(date)}
        />
        {selectedDate !== initialDate ? (
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(initialDate)}>
            Jump to today
          </Button>
        ) : null}

        <div className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Recent entries</h2>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Your entries will appear here once you start writing.
            </p>
          ) : (
            <ScrollArea className="h-[60vh]">
              <ul className="flex flex-col gap-1 pr-2">
                {entries.map((item) => {
                  const isActive = item.date === selectedDate;
                  const preview = item.title?.trim() || item.body.trim();
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(item.date)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors",
                          isActive
                            ? "border-primary/40 bg-accent"
                            : "border-transparent hover:bg-accent/60",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          {item.mood ? (
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: MOOD_COLORS[item.mood] ?? "#64748b" }}
                            />
                          ) : null}
                          {relativeDayLabel(item.date, initialDate)}
                        </span>
                        {preview ? (
                          <span className="text-muted-foreground line-clamp-1 text-xs">
                            {preview}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </div>
      </aside>

      <JournalEditor
        key={`${selectedDate}-${entry?.id ?? "new"}`}
        date={selectedDate}
        entry={entry}
        tags={tags}
      />
    </div>
  );
}

function JournalEditor({
  date,
  entry,
  tags,
}: {
  date: DateOnly;
  entry: JournalEntrySummary | null;
  tags: PickerOption[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<JournalEntryInput>({
    resolver: zodResolver(journalEntryInputSchema),
    defaultValues: {
      date,
      title: "",
      body: "",
      mood: null,
      gratitude: "",
      isPrivate: true,
      tagIds: [],
    },
  });

  useEffect(() => {
    form.reset({
      id: entry?.id,
      date: entry?.date ?? date,
      title: entry?.title ?? "",
      body: entry?.body ?? "",
      mood: (entry?.mood as JournalEntryInput["mood"]) ?? null,
      gratitude: entry?.gratitude ?? "",
      isPrivate: entry?.isPrivate ?? true,
      tagIds: entry?.tags.map((tag) => tag.id) ?? [],
    });
  }, [date, entry, form]);

  function onSubmit(values: JournalEntryInput) {
    startTransition(async () => {
      const result = await upsertJournalEntry({ ...values, date });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(entry ? "Entry updated" : "Entry saved");
    });
  }

  function onDelete() {
    if (!entry) return;
    startTransition(async () => {
      const result = await deleteJournalEntry(entry.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Entry deleted");
    });
  }

  return (
    <section className="border-border/70 bg-card flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookHeart className="text-muted-foreground size-4" />
          <h2 className="text-sm font-medium">{formatDateOnly(date, { withYear: true })}</h2>
        </div>
        {entry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={onDelete}
            className="text-destructive hover:text-destructive gap-1"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : null}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mood</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((mood) => {
                    const active = field.value === mood.value;
                    return (
                      <button
                        key={mood.value}
                        type="button"
                        onClick={() => field.onChange(active ? null : mood.value)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                          active
                            ? "border-transparent text-white"
                            : "text-muted-foreground hover:bg-accent/60",
                        )}
                        style={active ? { backgroundColor: mood.color } : undefined}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: active ? "#ffffff" : mood.color }}
                        />
                        {mood.label}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Give this day a headline (optional)"
                    {...field}
                    value={field.value ?? ""}
                  />
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
                <FormLabel>Entry</FormLabel>
                <FormControl>
                  <Textarea rows={12} placeholder="What happened today?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gratitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gratitude</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="What are you grateful for?"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                          style={
                            active ? { backgroundColor: tag.color ?? "#64748b" } : undefined
                          }
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
            name="isPrivate"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="journal-private">Private entry</Label>
                    <p className="text-muted-foreground text-xs">
                      Keep this entry visible only to you.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      id="journal-private"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="gap-1">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {entry ? "Save changes" : "Save entry"}
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
