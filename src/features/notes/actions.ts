"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { noteInputSchema } from "@/features/notes/schemas";

function revalidateNotes() {
  revalidatePath("/notes");
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

async function resolveTags(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const found = await db.tag.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  return found.map((tag) => tag.id);
}

export async function createNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = noteInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the note.", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const [lifeAreaId, projectId, tagIds] = await Promise.all([
    resolveLifeArea(user.id, data.lifeAreaId),
    resolveProject(user.id, data.projectId),
    resolveTags(user.id, data.tagIds),
  ]);

  const note = await db.note.create({
    data: {
      userId: user.id,
      title: data.title,
      body: data.body,
      format: data.format,
      pinned: data.pinned,
      archived: data.archived,
      lifeAreaId,
      projectId,
      tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
    },
    select: { id: true },
  });

  revalidateNotes();
  return ok({ id: note.id });
}

export async function updateNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = noteInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the note.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.id) return fail("Missing note id.");

  const existing = await db.note.findFirst({
    where: { id: data.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return fail("Note not found.");

  const [lifeAreaId, projectId, tagIds] = await Promise.all([
    resolveLifeArea(user.id, data.lifeAreaId),
    resolveProject(user.id, data.projectId),
    resolveTags(user.id, data.tagIds),
  ]);

  await db.note.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      body: data.body,
      format: data.format,
      pinned: data.pinned,
      archived: data.archived,
      lifeAreaId,
      projectId,
      tags: { set: tagIds.map((id) => ({ id })) },
    },
  });

  revalidateNotes();
  return ok({ id: existing.id });
}

export async function toggleNotePin(noteId: string): Promise<ActionResult<{ pinned: boolean }>> {
  const user = await requireOnboardedUser();
  const note = await db.note.findFirst({
    where: { id: noteId, userId: user.id },
    select: { id: true, pinned: true },
  });
  if (!note) return fail("Note not found.");

  const pinned = !note.pinned;
  await db.note.update({ where: { id: note.id }, data: { pinned } });
  revalidateNotes();
  return ok({ pinned });
}

export async function toggleNoteArchive(
  noteId: string,
): Promise<ActionResult<{ archived: boolean }>> {
  const user = await requireOnboardedUser();
  const note = await db.note.findFirst({
    where: { id: noteId, userId: user.id },
    select: { id: true, archived: true },
  });
  if (!note) return fail("Note not found.");

  const archived = !note.archived;
  await db.note.update({ where: { id: note.id }, data: { archived } });
  revalidateNotes();
  return ok({ archived });
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.note.deleteMany({ where: { id: noteId, userId: user.id } });
  if (result.count === 0) return fail("Note not found.");
  revalidateNotes();
  return ok(undefined);
}
