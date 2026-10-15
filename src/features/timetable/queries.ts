import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface PickerOption {
  id: string;
  name: string;
  color?: string | null;
}

export interface TimetableBlock {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  color: string | null;
  startMinutes: number;
  endMinutes: number;
  days: number[];
  taskId: string | null;
  lifeAreaId: string | null;
  task: { id: string; title: string } | null;
  lifeArea: { id: string; name: string; color: string } | null;
}

const blockSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  color: true,
  startMinutes: true,
  endMinutes: true,
  days: true,
  taskId: true,
  lifeAreaId: true,
  task: { select: { id: true, title: true } },
  lifeArea: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TimetableBlockSelect;

export async function listBlocks(userId: string): Promise<TimetableBlock[]> {
  return db.timetableBlock.findMany({
    where: { userId },
    select: blockSelect,
    orderBy: [{ startMinutes: "asc" }, { title: "asc" }],
  });
}

export async function getBlock(userId: string, id: string): Promise<TimetableBlock | null> {
  return db.timetableBlock.findFirst({
    where: { id, userId },
    select: blockSelect,
  });
}
