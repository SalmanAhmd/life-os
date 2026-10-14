"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import type { DateOnly } from "@/lib/dates";
import { createEvent, getEventForEdit, updateEvent } from "@/features/calendar/actions";
import { type CalendarEventInput, calendarEventInputSchema } from "@/features/calendar/schemas";
import type { RecurrenceInput } from "@/features/tasks/schemas";
import type { PickerOption } from "@/features/tasks/queries";
import {
  RecurrenceEditor,
  emptyRecurrenceInput,
} from "@/features/tasks/components/recurrence-editor";

export function EventFormDialog({
  open,
  onOpenChange,
  eventId,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultAllDay = false,
  lifeAreas,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  defaultDate: DateOnly;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultAllDay?: boolean;
  lifeAreas: PickerOption[];
  today: DateOnly;
}) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceInput>(
    emptyRecurrenceInput(defaultDate),
  );

  const form = useForm<CalendarEventInput>({
    resolver: zodResolver(calendarEventInputSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      meetingUrl: "",
      date: today,
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      lifeAreaId: null,
      recurrence: null,
    },
  });

  useEffect(() => {
    if (!open) return;

    if (eventId) {
      let active = true;
      setLoading(true);
      startTransition(async () => {
        const result = await getEventForEdit(eventId);
        if (!active) return;
        setLoading(false);
        if (!result.ok || !result.data) {
          toast.error("Could not load event");
          onOpenChange(false);
          return;
        }
        const detail = result.data;
        form.reset({
          id: detail.id,
          title: detail.title,
          description: detail.description ?? "",
          location: detail.location ?? "",
          meetingUrl: detail.meetingUrl ?? "",
          date: detail.date,
          startTime: detail.startTime ?? "09:00",
          endTime: detail.endTime ?? "10:00",
          allDay: detail.allDay,
          lifeAreaId: detail.lifeAreaId,
          recurrence: null,
        });
        setRecurring(Boolean(detail.recurrence));
        setRecurrence(detail.recurrence ?? emptyRecurrenceInput(detail.date));
      });
      return () => {
        active = false;
      };
    }

    form.reset({
      title: "",
      description: "",
      location: "",
      meetingUrl: "",
      date: defaultDate,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      allDay: defaultAllDay,
      lifeAreaId: null,
      recurrence: null,
    });
    setRecurring(false);
    setRecurrence(emptyRecurrenceInput(defaultDate));
  }, [
    open,
    eventId,
    defaultDate,
    defaultStartTime,
    defaultEndTime,
    defaultAllDay,
    today,
    form,
    onOpenChange,
  ]);

  const allDay = form.watch("allDay");

  function onSubmit(values: CalendarEventInput) {
    startTransition(async () => {
      const payload: CalendarEventInput = {
        ...values,
        description: values.description?.trim() ? values.description.trim() : null,
        location: values.location?.trim() ? values.location.trim() : null,
        meetingUrl: values.meetingUrl?.trim() ? values.meetingUrl.trim() : null,
        startTime: values.allDay ? null : values.startTime,
        endTime: values.allDay ? null : values.endTime,
        recurrence: recurring ? recurrence : null,
      };
      const result = eventId
        ? await updateEvent({ ...payload, id: eventId })
        : await createEvent(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(eventId ? "Event updated" : "Event created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{eventId ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {eventId
              ? "Update the details of this event."
              : "Block out time and keep it on your calendar."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input autoFocus placeholder="What is happening?" {...field} />
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Optional details"
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        clearable={false}
                        onChange={(date) => date && field.onChange(date)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex flex-col">
                  <Label htmlFor="all-day">All day</Label>
                  <span className="text-muted-foreground text-xs">
                    Show this event without a specific time.
                  </span>
                </div>
                <FormField
                  control={form.control}
                  name="allDay"
                  render={({ field }) => (
                    <FormControl>
                      <Switch
                        id="all-day"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  )}
                />
              </div>

              {!allDay ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starts</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ends</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
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
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="meetingUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting link</FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://…"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <RecurrenceEditor
                enabled={recurring}
                onEnabledChange={setRecurring}
                value={recurrence}
                onChange={setRecurrence}
              />

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {eventId ? "Save changes" : "Create event"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
