"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import {
  type DateOnly,
  addDays,
  dateOnlyToDb,
  dbDateToDateOnly,
  parseTimeToMinutes,
  todayDateOnly,
} from "@/lib/dates";
import { db } from "@/lib/db";
import {
  DEFAULT_POINT_RULES,
  type PointRules,
  buildPerfectDayAward,
  buildTaskCompletionAward,
  taskRewardKey,
} from "@/lib/rewards/rules";
import { ruleToDefinition } from "@/lib/recurrence/mapping";
import { awardOnce, pointRulesFromPreferences, reverseAward } from "@/features/rewards/service";
import { taskInputSchema, taskStatusSchema } from "@/features/tasks/schemas";
import { ensureOccurrencesForRange, getTaskDetail, type TaskDetail } from "@/features/tasks/queries";
import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/goals");
  revalidatePath("/rewards");
}

async function rulesFor(userId: string): Promise<PointRules> {
  const preferences = await db.userPreferences.findUnique({ where: { userId } });
  return preferences ? pointRulesFromPreferences(preferences) : DEFAULT_POINT_RULES;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  return parseTimeToMinutes(value);
}

async function resolveOwnedLifeArea(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.lifeArea.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveOwnedProject(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.project.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveOwnedParentTask(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.task.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveOwnedTags(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const found = await db.tag.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  return found.map((tag) => tag.id);
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the task details.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const [lifeAreaId, projectId, parentTaskId, tagIds] = await Promise.all([
    resolveOwnedLifeArea(user.id, data.lifeAreaId),
    resolveOwnedProject(user.id, data.projectId),
    resolveOwnedParentTask(user.id, data.parentTaskId),
    resolveOwnedTags(user.id, data.tagIds),
  ]);

  const hasRecurrence = Boolean(data.recurrence);

  const taskId = await db.$transaction(async (tx) => {
    let recurrenceRuleId: string | null = null;
    if (data.recurrence) {
      const rule = await tx.recurrenceRule.create({
        data: {
          userId: user.id,
          frequency: data.recurrence.frequency,
          interval: data.recurrence.interval,
          byWeekday: data.recurrence.byWeekday,
          byMonthDay: data.recurrence.byMonthDay ?? null,
          bySetPos: data.recurrence.bySetPos ?? null,
          byWeekdayForSetPos: data.recurrence.byWeekdayForSetPos ?? null,
          byMonth: data.recurrence.byMonth ?? null,
          startDate: dateOnlyToDb(data.recurrence.startDate),
          endDate: data.recurrence.endDate ? dateOnlyToDb(data.recurrence.endDate) : null,
          count: data.recurrence.count ?? null,
          timezone: user.timezone,
          exclusions: data.recurrence.exclusions,
        },
      });
      recurrenceRuleId = rule.id;
    }

    const task = await tx.task.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description ?? null,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        doDate: data.doDate ? dateOnlyToDb(data.doDate) : null,
        dueDate: data.dueDate ? dateOnlyToDb(data.dueDate) : null,
        startMinutes: timeToMinutes(data.startTime),
        endMinutes: timeToMinutes(data.endTime),
        estimatedMinutes: data.estimatedMinutes ?? null,
        actualMinutes: data.actualMinutes ?? null,
        lifeAreaId,
        projectId,
        parentTaskId,
        isRecurring: hasRecurrence,
        recurrenceRuleId,
        tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      },
      select: { id: true },
    });

    if (hasRecurrence) {
      await tx.task.update({ where: { id: task.id }, data: { seriesId: task.id } });
    }
    return task.id;
  });

  if (hasRecurrence) {
    const today = todayDateOnly(user.timezone);
    await ensureOccurrencesForRange(user.id, addDays(today, -30), addDays(today, 120));
  }

  revalidateTasks();
  return ok({ id: taskId });
}

export async function updateTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the task details.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing task id.");

  const existing = await db.task.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true, recurrenceRuleId: true },
  });
  if (!existing) return fail("Task not found.");

  const [lifeAreaId, projectId, parentTaskId, tagIds] = await Promise.all([
    resolveOwnedLifeArea(user.id, data.lifeAreaId),
    resolveOwnedProject(user.id, data.projectId),
    resolveOwnedParentTask(user.id, data.parentTaskId),
    resolveOwnedTags(user.id, data.tagIds),
  ]);

  const hasRecurrence = Boolean(data.recurrence);

  await db.$transaction(async (tx) => {
    let recurrenceRuleId: string | null = existing.recurrenceRuleId;

    if (data.recurrence) {
      if (recurrenceRuleId) {
        await tx.recurrenceRule.update({
          where: { id: recurrenceRuleId },
          data: {
            frequency: data.recurrence.frequency,
            interval: data.recurrence.interval,
            byWeekday: data.recurrence.byWeekday,
            byMonthDay: data.recurrence.byMonthDay ?? null,
            bySetPos: data.recurrence.bySetPos ?? null,
            byWeekdayForSetPos: data.recurrence.byWeekdayForSetPos ?? null,
            byMonth: data.recurrence.byMonth ?? null,
            startDate: dateOnlyToDb(data.recurrence.startDate),
            endDate: data.recurrence.endDate ? dateOnlyToDb(data.recurrence.endDate) : null,
            count: data.recurrence.count ?? null,
            exclusions: data.recurrence.exclusions,
          },
        });
      } else {
        const rule = await tx.recurrenceRule.create({
          data: {
            userId: user.id,
            frequency: data.recurrence.frequency,
            interval: data.recurrence.interval,
            byWeekday: data.recurrence.byWeekday,
            byMonthDay: data.recurrence.byMonthDay ?? null,
            bySetPos: data.recurrence.bySetPos ?? null,
            byWeekdayForSetPos: data.recurrence.byWeekdayForSetPos ?? null,
            byMonth: data.recurrence.byMonth ?? null,
            startDate: dateOnlyToDb(data.recurrence.startDate),
            endDate: data.recurrence.endDate ? dateOnlyToDb(data.recurrence.endDate) : null,
            count: data.recurrence.count ?? null,
            timezone: user.timezone,
            exclusions: data.recurrence.exclusions,
          },
        });
        recurrenceRuleId = rule.id;
      }
    } else if (recurrenceRuleId) {
      // Recurrence removed: detach and delete the rule; keep already-completed
      // history intact by leaving occurrence rows in place.
      const oldRuleId = recurrenceRuleId;
      recurrenceRuleId = null;
      await tx.task.update({ where: { id: data.id }, data: { recurrenceRuleId: null } });
      await tx.recurrenceRule.delete({ where: { id: oldRuleId } }).catch(() => undefined);
    }

    await tx.task.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        doDate: data.doDate ? dateOnlyToDb(data.doDate) : null,
        dueDate: data.dueDate ? dateOnlyToDb(data.dueDate) : null,
        startMinutes: timeToMinutes(data.startTime),
        endMinutes: timeToMinutes(data.endTime),
        estimatedMinutes: data.estimatedMinutes ?? null,
        actualMinutes: data.actualMinutes ?? null,
        lifeAreaId,
        projectId,
        parentTaskId,
        isRecurring: hasRecurrence,
        recurrenceRuleId,
        seriesId: hasRecurrence ? data.id : null,
        tags: { set: tagIds.map((id) => ({ id })) },
      },
    });
  });

  if (hasRecurrence) {
    const today = todayDateOnly(user.timezone);
    await ensureOccurrencesForRange(user.id, addDays(today, -30), addDays(today, 120));
  }

  revalidateTasks();
  revalidatePath(`/tasks/${data.id}`);
  return ok({ id: data.id });
}

export async function getTaskForEdit(
  id: string,
): Promise<ActionResult<TaskDetail | null>> {
  const user = await requireOnboardedUser();
  const detail = await getTaskDetail(user.id, id);
  return ok(detail);
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.task.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("Task not found.");
  revalidateTasks();
  return ok(undefined);
}

async function maybeAwardPerfectDay(
  userId: string,
  date: DateOnly,
  rules: PointRules,
): Promise<void> {
  const award = buildPerfectDayAward(date, rules);
  if (!award) return;

  const dbDate = dateOnlyToDb(date);
  const [pendingTasks, pendingOccurrences, doneTasks, doneOccurrences] = await Promise.all([
    db.task.count({
      where: { userId, isRecurring: false, parentTaskId: null, archivedAt: null, doDate: dbDate, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    db.taskOccurrence.count({ where: { userId, scheduledFor: dbDate, status: "PENDING" } }),
    db.task.count({
      where: { userId, isRecurring: false, parentTaskId: null, doDate: dbDate, status: "COMPLETED" },
    }),
    db.taskOccurrence.count({ where: { userId, scheduledFor: dbDate, status: "COMPLETED" } }),
  ]);

  const eligible = doneTasks + doneOccurrences;
  if (pendingTasks + pendingOccurrences > 0 || eligible === 0) return;

  await awardOnce(db, userId, award, { note: "All tasks completed" });
}

async function completeSimpleTask(userId: string, taskId: string): Promise<void> {
  const rules = await rulesFor(userId);
  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, priority: true, status: true, completedAt: true },
  });
  if (!task || task.status === "COMPLETED") return;

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.taskCompletion.create({
      data: { userId, taskId, completedAt: new Date() },
    });
    const award = buildTaskCompletionAward(
      { kind: "task", taskId },
      task.priority as TaskPriority,
      rules,
    );
    if (award) await awardOnce(tx, userId, award, { taskId });
  });
}

async function reopenSimpleTask(userId: string, taskId: string): Promise<void> {
  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, status: true },
  });
  if (!task || task.status !== "COMPLETED") return;

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { status: "TODO", completedAt: null },
    });
    await reverseAward(tx, userId, taskRewardKey(taskId), { taskId });
  });
}

export async function toggleTaskComplete(taskId: string): Promise<ActionResult<{ status: TaskStatus }>> {
  const user = await requireOnboardedUser();
  const task = await db.task.findFirst({
    where: { id: taskId, userId: user.id },
    select: { status: true },
  });
  if (!task) return fail("Task not found.");

  if (task.status === "COMPLETED") {
    await reopenSimpleTask(user.id, taskId);
    revalidateTasks();
    return ok({ status: "TODO" as TaskStatus });
  }

  await completeSimpleTask(user.id, taskId);
  const today = todayDateOnly(user.timezone);
  await maybeAwardPerfectDay(user.id, today, await rulesFor(user.id));
  revalidateTasks();
  return ok({ status: "COMPLETED" as TaskStatus });
}

export async function setTaskStatus(
  taskId: string,
  status: string,
): Promise<ActionResult<{ status: TaskStatus }>> {
  const user = await requireOnboardedUser();
  const parsed = taskStatusSchema.safeParse(status);
  if (!parsed.success) return fail("Invalid status update.");

  const next = parsed.data as TaskStatus;
  if (next === "COMPLETED") return toggleTaskComplete(taskId);

  const result = await db.task.updateMany({
    where: { id: taskId, userId: user.id, isRecurring: false },
    data: { status: next, completedAt: null },
  });
  if (result.count === 0) return fail("Task not found.");
  revalidateTasks();
  return ok({ status: next });
}

export async function toggleSubtaskComplete(subtaskId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const task = await db.task.findFirst({
    where: { id: subtaskId, userId: user.id, parentTaskId: { not: null } },
    select: { status: true },
  });
  if (!task) return fail("Subtask not found.");
  if (task.status === "COMPLETED") {
    await db.task.updateMany({
      where: { id: subtaskId, userId: user.id },
      data: { status: "TODO", completedAt: null },
    });
  } else {
    await db.task.updateMany({
      where: { id: subtaskId, userId: user.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
  revalidateTasks();
  return ok(undefined);
}

// --- Recurring occurrences ------------------------------------------------

export async function toggleOccurrence(occurrenceId: string): Promise<ActionResult<{ status: string }>> {
  const user = await requireOnboardedUser();
  const occurrence = await db.taskOccurrence.findFirst({
    where: { id: occurrenceId, userId: user.id },
    select: {
      id: true,
      status: true,
      seriesId: true,
      task: { select: { id: true, priority: true } },
    },
  });
  if (!occurrence) return fail("Occurrence not found.");

  const rules = await rulesFor(user.id);

  if (occurrence.status === "COMPLETED") {
    await db.$transaction(async (tx) => {
      await tx.taskOccurrence.update({
        where: { id: occurrenceId },
        data: { status: "PENDING", completedAt: null },
      });
      await reverseAward(tx, user.id, `occurrence:completed:${occurrenceId}`, {
        taskId: occurrence.task.id,
        occurrenceId,
      });
    });
    revalidateTasks();
    return ok({ status: "PENDING" });
  }

  await db.$transaction(async (tx) => {
    await tx.taskOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await tx.taskCompletion.create({
      data: {
        userId: user.id,
        taskId: occurrence.task.id,
        occurrenceId,
        completedAt: new Date(),
      },
    });
    const award = buildTaskCompletionAward(
      { kind: "occurrence", occurrenceId },
      occurrence.task.priority as TaskPriority,
      rules,
    );
    if (award) await awardOnce(tx, user.id, award, { taskId: occurrence.task.id, occurrenceId });
  });

  revalidateTasks();
  return ok({ status: "COMPLETED" });
}

export async function toggleOccurrenceSkip(occurrenceId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const occurrence = await db.taskOccurrence.findFirst({
    where: { id: occurrenceId, userId: user.id },
    select: { id: true, skipped: true, status: true },
  });
  if (!occurrence) return fail("Occurrence not found.");

  const nextSkipped = !occurrence.skipped;
  await db.taskOccurrence.update({
    where: { id: occurrenceId },
    data: {
      skipped: nextSkipped,
      status: nextSkipped ? "SKIPPED" : occurrence.status === "COMPLETED" ? "COMPLETED" : "PENDING",
    },
  });
  revalidateTasks();
  return ok(undefined);
}

export async function moveOccurrence(
  occurrenceId: string,
  newDate: DateOnly,
): Promise<ActionResult> {
  const onboarded = await requireOnboardedUser();
  const occurrence = await db.taskOccurrence.findFirst({
    where: { id: occurrenceId, userId: onboarded.id },
    select: { id: true, scheduledFor: true },
  });
  if (!occurrence) return fail("Occurrence not found.");

  await db.taskOccurrence.update({
    where: { id: occurrenceId },
    data: { movedTo: dateOnlyToDb(newDate) },
  });
  revalidateTasks();
  return ok(undefined);
}

/** Adds a single date to the series exclusion list (removes one occurrence). */
export async function excludeOccurrence(occurrenceId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const occurrence = await db.taskOccurrence.findFirst({
    where: { id: occurrenceId, userId: user.id },
    select: { id: true, scheduledFor: true, task: { select: { recurrenceRule: true } } },
  });
  if (!occurrence) return fail("Occurrence not found.");

  const rule = occurrence.task.recurrenceRule;
  const date = dbDateToDateOnly(occurrence.scheduledFor);

  if (rule) {
    const definition = ruleToDefinition(rule);
    const exclusions = Array.from(new Set([...definition.exclusions, date]));
    await db.recurrenceRule.update({
      where: { id: rule.id },
      data: { exclusions },
    });
  }
  await db.taskOccurrence.deleteMany({ where: { id: occurrenceId, userId: user.id } });
  revalidateTasks();
  return ok(undefined);
}

/** Reschedules every future occurrence of a series by the given day delta. */
export async function shiftSeries(
  seriesId: string,
  days: number,
): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  if (!Number.isInteger(days) || days === 0) return fail("Invalid shift.");

  const template = await db.task.findFirst({
    where: { userId: user.id, seriesId, isRecurring: true },
    select: { id: true },
  });
  if (!template) return fail("Series not found.");

  const today = todayDateOnly(user.timezone);
  const upcoming = await db.taskOccurrence.findMany({
    where: {
      userId: user.id,
      seriesId,
      scheduledFor: { gte: dateOnlyToDb(today) },
      status: "PENDING",
    },
    select: { id: true, scheduledFor: true },
  });

  await db.$transaction(
    upcoming.map((occurrence) => {
      const next = addDays(dbDateToDateOnly(occurrence.scheduledFor), days);
      return db.taskOccurrence.update({
        where: { id: occurrence.id },
        data: { movedTo: dateOnlyToDb(next) },
      });
    }),
  );
  revalidateTasks();
  return ok(undefined);
}

export type { TaskStatus, TaskPriority };
