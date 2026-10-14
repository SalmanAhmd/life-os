"use server";

import { revalidatePath } from "next/cache";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { requireOnboardedUser } from "@/lib/auth/current-user";
import { dateOnlyToDb } from "@/lib/dates";
import { db } from "@/lib/db";
import { journalEntryInputSchema } from "@/features/journal/schemas";

function revalidateJournal() {
  revalidatePath("/journal");
}

async function resolveTags(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const found = await db.tag.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  return found.map((tag) => tag.id);
}

export async function upsertJournalEntry(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireOnboardedUser();
  const parsed = journalEntryInputSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the entry.", zodFieldErrors(parsed.error));
  const data = parsed.data;
  if (!data.date) return fail("A date is required.");

  const date = dateOnlyToDb(data.date);
  const [tagIds, existing] = await Promise.all([
    resolveTags(user.id, data.tagIds),
    db.journalEntry.findFirst({
      where: { userId: user.id, date },
      select: { id: true },
    }),
  ]);

  const title = data.title?.trim() ? data.title.trim() : null;
  const gratitude = data.gratitude?.trim() ? data.gratitude.trim() : null;

  const payload = {
    title,
    body: data.body,
    mood: data.mood ?? null,
    gratitude,
    isPrivate: data.isPrivate,
  };

  const entry = existing
    ? await db.journalEntry.update({
        where: { id: existing.id },
        data: { ...payload, tags: { set: tagIds.map((id) => ({ id })) } },
        select: { id: true },
      })
    : await db.journalEntry.create({
        data: {
          userId: user.id,
          date,
          ...payload,
          tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
        },
        select: { id: true },
      });

  revalidateJournal();
  return ok({ id: entry.id });
}

export async function deleteJournalEntry(entryId: string): Promise<ActionResult> {
  const user = await requireOnboardedUser();
  const result = await db.journalEntry.deleteMany({ where: { id: entryId, userId: user.id } });
  if (result.count === 0) return fail("Entry not found.");
  revalidateJournal();
  return ok(undefined);
}
