import "server-only";

import { db } from "@/lib/db";

export type LifeAreaSummary = {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  isArchived: boolean;
};

export async function listLifeAreas(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<LifeAreaSummary[]> {
  return db.lifeArea.findMany({
    where: { userId, ...(options.includeArchived ? {} : { isArchived: false }) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true, icon: true, order: true, isArchived: true },
  });
}
