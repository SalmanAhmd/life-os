"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateNotifications } from "@/features/settings/actions";
import { notificationsInputSchema, type NotificationsInput } from "@/features/settings/schemas";

interface NotificationsFormProps {
  defaultValues: NotificationsInput;
}

export function NotificationsForm({ defaultValues }: NotificationsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<NotificationsInput>({
    resolver: zodResolver(notificationsInputSchema),
    defaultValues,
  });

  const notifyBrowser = form.watch("notifyBrowser");

  useEffect(() => {
    if (typeof window !== "undefined" && notifyBrowser) {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          toast.success("Browser notifications enabled");
        } else if (permission === "denied") {
          toast.error("Notifications blocked. Enable in browser settings.");
          form.setValue("notifyBrowser", false);
        }
      });
    }
  }, [notifyBrowser, form]);

  function onSubmit(data: NotificationsInput) {
    startTransition(async () => {
      const result = await updateNotifications(data);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to update notifications");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof NotificationsInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      toast.success("Notifications updated");
    });
  }

  const reminderOptions = [
    { value: "0", label: "None" },
    { value: "5", label: "5 min" },
    { value: "10", label: "10 min" },
    { value: "15", label: "15 min" },
    { value: "30", label: "30 min" },
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
    { value: "1440", label: "1 day" },
  ] as const;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="notifyInApp"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel className="mb-0">In-app notifications</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notifyBrowser"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel className="mb-0 flex items-center gap-2">
                  Browser notifications
                  <span className="text-xs text-muted-foreground">Requires permission</span>
                </FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <fieldset className="border-border/60 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4 flex items-center gap-2">
            <Bell className="size-4" />
            Daily agenda
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="dailyAgendaEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel className="mb-0">Enable daily agenda</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dailyAgendaTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send at</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <FormField
          control={form.control}
          name="defaultReminderMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default reminder (minutes before)</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {reminderOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending}>
            Save notifications
          </Button>
        </div>
      </form>
    </Form>
  );
}