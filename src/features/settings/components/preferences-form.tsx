"use client";

import { useTheme } from "next-themes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePreferences } from "@/features/settings/actions";
import { preferencesInputSchema, type PreferencesInput } from "@/features/settings/schemas";

interface PreferencesFormProps {
  defaultValues: PreferencesInput;
}

export function PreferencesForm({ defaultValues }: PreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const { setTheme } = useTheme();

  const form = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesInputSchema),
    defaultValues,
  });

  function onSubmit(data: PreferencesInput) {
    startTransition(async () => {
      const result = await updatePreferences(data);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save preferences");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof PreferencesInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      if (data.theme) setTheme(data.theme);
      toast.success("Preferences saved");
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="theme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Theme</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timeFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time format</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="12h">12-hour</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="weekStartsOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Week starts on</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultTaskView"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default task view</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="list">List</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="board">Board</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <fieldset className="border-border/60 rounded-lg border p-4">
          <legend className="text-sm font-medium mb-4">Reward points</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="pointsPerTask"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Per task completion</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pointsPerHabit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Per habit check-in</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pointsPerMilestone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Per milestone</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="perfectDayBonus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfect day bonus</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <FormField
              control={form.control}
              name="pointsPerHighPriority"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <FormLabel className="mb-0">High priority bonus</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="highPriorityBonus"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormLabel className="w-auto">Bonus amount</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" className="w-24" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <FormField
              control={form.control}
              name="perfectDayEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <FormLabel className="mb-0">Enable perfect day bonus</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending}>
            Save preferences
          </Button>
        </div>
      </form>
    </Form>
  );
}