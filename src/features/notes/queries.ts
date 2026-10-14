import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { PickerOption } from "@/features/tasks/queries";

const noteSelect = {
  id: true,
  title: true,
  body: true,
  format: true,
  pinned: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  lifeAreaId: true,
  projectId: true,
  lifeArea: { select: { id: true, name: true, color: true } },
  project: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
} satisfies Prisma.NoteSelect;

type NoteRow = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;

export interface NoteSummary {
  id: string;
  title: string;
  body: string;
  format: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lifeArea: { id: string; name: string; color: string } | null;
  project: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
}

export interface NoteFormOptions {
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  tags: PickerOption[];
}

function toSummary(row: NoteRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    format: row.format,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lifeArea: row.lifeArea,
    project: row.project,
    tags: row.tags,
  };
}

export async function listNotes(
  userId: string,
  options: { search?: string; includeArchived?: boolean } = {},
): Promise<NoteSummary[]> {
  const search = options.search?.trim();
  const rows = await db.note.findMany({
    where: {
      userId,
      ...(options.includeArchived ? {} : { archived: false }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: noteSelect,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toSummary);
}

export async function getNote(userId: string, id: string): Promise<NoteSummary | null> {
  const row = await db.note.findFirst({ where: { id, userId }, select: noteSelect });
  return row ? toSummary(row) : null;
}

export async function listNoteOptions(userId: string): Promise<NoteFormOptions> {
  const [lifeAreas, projects, tags] = await Promise.all([
    db.lifeArea.findMany({
      where: { userId, isArchived: false },
      select: { id: true, name: true, color: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    db.project.findMany({
      where: { userId, archivedAt: null, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.tag.findMany({
      where: { userId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { lifeAreas, projects, tags };
}
