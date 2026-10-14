import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import { JournalView } from "@/features/journal/components/journal-view";
import { listJournalEntries } from "@/features/journal/queries";

export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [entries, tags] = await Promise.all([
    listJournalEntries(user.id, { limit: 200 }),
    db.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
        <p className="text-muted-foreground text-sm">
          Reflect on your days, weeks and months.
        </p>
      </div>
      <JournalView initialDate={today} entries={entries} tags={tags} />
    </div>
  );
}
