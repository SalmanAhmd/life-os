"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { dateOnlyToDb } from "@/lib/dates";
import { db } from "@/lib/db";
import { projectInputSchema, projectMilestoneInputSchema } from "@/features/projects/schemas";
import { getProjectDetail, type ProjectDetail } from "@/features/projects/queries";

export async function getProjectForEdit(
  id: string,
): Promise<ActionResult<ProjectDetail | null>> {
  const user = await requireOnboardedUser();
  const detail = await getProjectDetail(user.id, id);
  return ok(detail);
}

function revalidateProjects() {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

async function resolveLifeArea(userId: string, id: string | null | undefined) {
  if (!id) return null;
  const found = await db.lifeArea.findFirst({ where: { id, userId }, select: { id: true } });
  return found?.id ?? null;
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the project.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const lifeAreaId = await resolveLifeArea(user.id, data.lifeAreaId);

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate ? dateOnlyToDb(data.startDate) : null,
      targetDate: data.targetDate ? dateOnlyToDb(data.targetDate) : null,
      lifeAreaId,
    },
    select: { id: true },
  });

  revalidateProjects();
  return ok({ id: project.id });
}

export async function updateProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the project.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing project id.");

  const lifeAreaId = await resolveLifeArea(user.id, data.lifeAreaId);

  const result = await db.project.updateMany({
    where: { id: data.id, userId: user.id },
    data: {
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      startDate: data.startDate ? dateOnlyToDb(data.startDate) : null,
      targetDate: data.targetDate ? dateOnlyToDb(data.targetDate) : null,
      lifeAreaId,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
  });
  if (result.count === 0) return fail("Project not found.");
  revalidateProjects();
  return ok({ id: data.id });
}

export async function setProjectStatus(id: string, status: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const allowed = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) {
    return fail("Invalid status.");
  }

  const result = await db.project.updateMany({
    where: { id, userId: user.id },
    data: {
      status: status as (typeof allowed)[number],
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
  if (result.count === 0) return fail("Project not found.");
  revalidateProjects();
  return ok(undefined);
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.project.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date(), status: "ARCHIVED" },
  });
  if (result.count === 0) return fail("Project not found.");
  revalidateProjects();
  return ok(undefined);
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.project.updateMany({
    where: { id, userId: user.id, archivedAt: { not: null } },
    data: { archivedAt: null, status: "ACTIVE" },
  });
  if (result.count === 0) return fail("Project not found.");
  revalidateProjects();
  return ok(undefined);
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.project.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("Project not found.");
  revalidateProjects();
  return ok(undefined);
}

export async function addMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = projectMilestoneInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the milestone.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const project = await db.project.findFirst({ where: { id: data.projectId, userId: user.id }, select: { id: true } });
  if (!project) return fail("Project not found.");

  const maxOrder = await db.projectMilestone.aggregate({
    where: { projectId: project.id },
    _max: { order: true },
  });

  const milestone = await db.projectMilestone.create({
    data: {
      userId: user.id,
      projectId: project.id,
      title: data.title,
      dueDate: data.dueDate ? dateOnlyToDb(data.dueDate) : null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidateProjects();
  return ok({ id: milestone.id });
}

export async function toggleMilestone(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const milestone = await db.projectMilestone.findFirst({
    where: { id, userId: user.id },
    select: { id: true, completedAt: true },
  });
  if (!milestone) return fail("Milestone not found.");

  await db.projectMilestone.update({
    where: { id },
    data: { completedAt: milestone.completedAt ? null : new Date() },
  });
  revalidateProjects();
  return ok(undefined);
}

export async function updateMilestone(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = projectMilestoneInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the milestone.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing milestone id.");

  const result = await db.projectMilestone.updateMany({
    where: { id: data.id, userId: user.id, projectId: data.projectId },
    data: {
      title: data.title,
      dueDate: data.dueDate ? dateOnlyToDb(data.dueDate) : null,
    },
  });
  if (result.count === 0) return fail("Milestone not found.");
  revalidateProjects();
  return ok({ id: data.id });
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.projectMilestone.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("Milestone not found.");
  revalidateProjects();
  return ok(undefined);
}
