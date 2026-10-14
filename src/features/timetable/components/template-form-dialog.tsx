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
import { Switch } from "@/components/ui/switch";
import { createTemplate, updateTemplate } from "@/features/timetable/actions";
import { templateInputSchema, type TemplateInput } from "@/features/timetable/schemas";
import type { TimetableTemplateSummary } from "@/features/timetable/queries";

interface TemplateFormDialogProps {
  template: TimetableTemplateSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateFormDialog({ template, open, onOpenChange }: TemplateFormDialogProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateInputSchema),
    defaultValues: template
      ? { id: template.id, name: template.name, description: template.description ?? "", dayType: template.dayType as "weekday" | "weekend" | "custom", isDefault: template.isDefault }
      : { name: "", description: "", dayType: "custom", isDefault: false },
  });

  function onSubmit(data: TemplateInput) {
    startTransition(async () => {
      const result = template ? await updateTemplate(data) : await createTemplate(data);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save template");
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, messages]) => {
            form.setError(field as keyof TemplateInput, { type: "server", message: messages[0] });
          });
        }
        return;
      }
      toast.success(template ? "Template updated" : "Template created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            {template ? "Update your timetable template" : "Create a reusable schedule template"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Deep work day" {...field} />
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
                    <Textarea placeholder="What this template is for..." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dayType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekday">Weekday</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel className="mb-0">Set as default template</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {template ? "Save changes" : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}