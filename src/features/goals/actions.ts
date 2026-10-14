"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { dateOnlyToDb } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  DEFAULT_POINT_RULES,
  type PointRules,
  buildMilestoneAward,
  milestoneRewardKey,
} from "@/lib/rewards/rules";
import { awardOnce, pointRulesFromPreferences, reverseAward } from "@/features/rewards/service";
import {
  goalInputSchema,
  goalTaskLinkSchema,
  milestoneInputSchema,
} from "@/features/goals/schemas";
import { getGoalDetail, type GoalDetail } from "@/features/goals/queries";

export async function getGoalForEdit(
  goalId: string,
): Promise<ActionResult<GoalDetail | null>> {
  const user = await requireOnboardedUser();
  const detail = await getGoalDetail(user.id, goalId);
  return ok(detail);
}

function revalidateGoals(goalId?: string) {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/rewards");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

async function rulesFor(userId: string): Promise<PointRules> {
  const preferences = await db.userPreferences.findUnique({ where: { userId } });
  return preferences ? pointRulesFromPreferences(preferences) : DEFAULT_POINT_RULES;
}

async function resolveLifeArea(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.lifeArea.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveProject(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.project.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

async function resolveParentGoal(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.goal.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

export async function createGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = goalInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the goal.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const [lifeAreaId, projectId, parentGoalId] = await Promise.all([
    resolveLifeArea(user.id, data.lifeAreaId),
    resolveProject(user.id, data.projectId),
    resolveParentGoal(user.id, data.parentGoalId),
  ]);

  const goal = await db.goal.create({
    data: {
      userId: user.id,
      title: data.title,
      description: data.description ?? null,
      timeframe: data.timeframe,
      status: data.status,
      priority: data.priority,
      metricType: data.metricType,
      startDate: dateOnlyToDb(data.startDate),
      targetDate: data.targetDate ? dateOnlyToDb(data.targetDate) : null,
      targetValue: data.targetValue ?? null,
      currentValue: data.currentValue ?? null,
      unit: data.unit ?? null,
      lifeAreaId,
      projectId,
      parentGoalId,
    },
    select: { id: true },
  });

  revalidateGoals(goal.id);
  return ok({ id: goal.id });
}

export async function updateGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = goalInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the goal.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing goal id.");

  const [lifeAreaId, projectId, parentGoalId] = await Promise.all([
    resolveLifeArea(user.id, data.lifeAreaId),
    resolveProject(user.id, data.projectId),
    resolveParentGoal(user.id, data.parentGoalId),
  ]);

  const result = await db.goal.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      title: data.title,
      description: data.description ?? null,
      timeframe: data.timeframe,
      status: data.status,
      priority: data.priority,
      metricType: data.metricType,
      startDate: dateOnlyToDb(data.startDate),
      targetDate: data.targetDate ? dateOnlyToDb(data.targetDate) : null,
      targetValue: data.targetValue ?? null,
      currentValue: data.currentValue ?? null,
      unit: data.unit ?? null,
      lifeAreaId,
      projectId,
      parentGoalId,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
  });
  if (result.count === 0) return fail("Goal not found.");
  revalidateGoals(data.id);
  return ok({ id: data.id });
}

export async function setGoalStatus(goalId: string, status: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const allowed = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) return fail("Invalid status.");

  const result = await db.goal.updateMany({
    where: { id: goalId, userId: user.id },
    data: { status: status as (typeof allowed)[number], completedAt: status === "COMPLETED" ? new Date() : null },
  });
  if (result.count === 0) return fail("Goal not found.");
  revalidateGoals(goalId);
  return ok(undefined);
}

export async function updateGoalValue(goalId: string, value: number): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  if (!Number.isFinite(value) || value < 0) return fail("Invalid value.");
  const result = await db.goal.updateMany({
    where: { id: goalId, userId: user.id },
    data: { currentValue: value },
  });
  if (result.count === 0) return fail("Goal not found.");
  revalidateGoals(goalId);
  return ok(undefined);
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.goal.deleteMany({ where: { id: goalId, userId: user.id } });
  if (result.count === 0) return fail("Goal not found.");
  revalidateGoals();
  return ok(undefined);
}

// --- Milestones ------------------------------------------------------------

export async function addMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = milestoneInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the milestone.", zodFieldErrors(parsed.error));

  const goal = await db.goal.findFirst({
    where: { id: parsed.data.goalId, userId: user.id },
    select: { id: true },
  });
  if (!goal) return fail("Goal not found.");

  const count = await db.goalMilestone.count({ where: { goalId: goal.id } });
  const milestone = await db.goalMilestone.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      title: parsed.data.title,
      dueDate: parsed.data.dueDate ? dateOnlyToDb(parsed.data.dueDate) : null,
      order: count,
    },
    select: { id: true },
  });
  revalidateGoals(goal.id);
  return ok({ id: milestone.id });
}

export async function toggleMilestone(
  milestoneId: string,
): Promise<ActionResult<{ completed: boolean }>> {
  const user = await requireOnboardedUser();
  const milestone = await db.goalMilestone.findFirst({
    where: { id: milestoneId, userId: user.id },
    select: { id: true, goalId: true, completedAt: true },
  });
  if (!milestone) return fail("Milestone not found.");

  const rules = await rulesFor(user.id);
  const completing = !milestone.completedAt;

  await db.$transaction(async (tx) => {
    await tx.goalMilestone.update({
      where: { id: milestoneId },
      data: { completedAt: completing ? new Date() : null },
    });
    const key = milestoneRewardKey(milestoneId);
    if (completing) {
      const award = buildMilestoneAward(milestoneId, rules);
      if (award) await awardOnce(tx, user.id, award, { goalMilestoneId: milestoneId });
    } else {
      await reverseAward(tx, user.id, key, { goalMilestoneId: milestoneId });
    }
  });

  revalidateGoals(milestone.goalId);
  return ok({ completed: completing });
}

export async function updateMilestone(input: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = milestoneInputSchema.safeParse(input);
  if (!parsed.success || !parsed.data.id) return fail("Invalid milestone.");

  const milestone = await db.goalMilestone.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, goalId: true },
  });
  if (!milestone) return fail("Milestone not found.");

  await db.goalMilestone.update({
    where: { id: milestone.id },
    data: {
      title: parsed.data.title,
      dueDate: parsed.data.dueDate ? dateOnlyToDb(parsed.data.dueDate) : null,
    },
  });
  revalidateGoals(milestone.goalId);
  return ok(undefined);
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const milestone = await db.goalMilestone.findFirst({
    where: { id: milestoneId, userId: user.id },
    select: { id: true, goalId: true },
  });
  if (!milestone) return fail("Milestone not found.");
  await db.goalMilestone.delete({ where: { id: milestone.id } });
  revalidateGoals(milestone.goalId);
  return ok(undefined);
}

// --- Task links ------------------------------------------------------------

export async function linkTask(input: unknown): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const parsed = goalTaskLinkSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid link.");

  const [goal, task] = await Promise.all([
    db.goal.findFirst({ where: { id: parsed.data.goalId, userId: user.id }, select: { id: true } }),
    db.task.findFirst({ where: { id: parsed.data.taskId, userId: user.id }, select: { id: true } }),
  ]);
  if (!goal || !task) return fail("Goal or task not found.");

  await db.goalTask.upsert({
    where: { goalId_taskId: { goalId: goal.id, taskId: task.id } },
    update: {},
    create: { userId: user.id, goalId: goal.id, taskId: task.id },
  });
  revalidateGoals(goal.id);
  return ok(undefined);
}

export async function unlinkTask(goalId: string, taskId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const goal = await db.goal.findFirst({
    where: { id: goalId, userId: user.id },
    select: { id: true },
  });
  if (!goal) return fail("Goal not found.");
  await db.goalTask.deleteMany({ where: { goalId: goal.id, taskId, userId: user.id } });
  revalidateGoals(goal.id);
  return ok(undefined);
}
