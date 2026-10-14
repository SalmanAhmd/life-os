import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { NotesView } from "@/features/notes/components/notes-view";
import { listNoteOptions, listNotes } from "@/features/notes/queries";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await requireUser();

  const [notes, options] = await Promise.all([
    listNotes(user.id, { includeArchived: true }),
    listNoteOptions(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="text-muted-foreground text-sm">
          Capture ideas and reference material.
        </p>
      </div>
      <NotesView
        notes={notes}
        lifeAreas={options.lifeAreas}
        projects={options.projects}
        tags={options.tags}
      />
    </div>
  );
}
