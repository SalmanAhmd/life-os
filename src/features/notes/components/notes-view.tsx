"use client";

import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteNote,
  toggleNoteArchive,
  toggleNotePin,
} from "@/features/notes/actions";
import { NoteFormDialog } from "@/features/notes/components/note-form-dialog";
import type { NoteSummary } from "@/features/notes/queries";
import type { PickerOption } from "@/features/tasks/queries";

export function NotesView({
  notes,
  lifeAreas,
  projects,
  tags,
}: {
  notes: NoteSummary[];
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  tags: PickerOption[];
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NoteSummary | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query),
    );
  }, [notes, search]);

  const active = filtered.filter((note) => !note.archived);
  const archived = filtered.filter((note) => note.archived);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(note: NoteSummary) {
    setEditing(note);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes"
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New note
        </Button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <StickyNote className="text-muted-foreground size-6" />
          <p className="mt-2 font-medium">{search ? "No matching notes" : "No notes yet"}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {search
              ? "Try a different search term."
              : "Capture ideas, references and anything worth remembering."}
          </p>
          {!search ? (
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
              <Plus className="size-4" />
              New note
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Archived</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((note) => (
              <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} />
            ))}
          </ul>
        </section>
      ) : null}

      <NoteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        note={editing}
        lifeAreas={lifeAreas}
        projects={projects}
        tags={tags}
      />
    </div>
  );
}

function NoteCard({ note, onEdit }: { note: NoteSummary; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(message);
    });
  }

  const preview = note.body.trim();

  return (
    <li className="border-border/70 bg-card flex items-start gap-3 rounded-lg border p-4">
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-1.5 text-left",
          isPending && "opacity-60",
        )}
      >
        <div className="flex items-center gap-1.5">
          {note.pinned ? <Pin className="text-primary size-3.5 shrink-0" /> : null}
          <span className="truncate text-sm font-medium">{note.title}</span>
        </div>
        {preview ? (
          <span className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap">
            {preview}
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {note.lifeArea ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: note.lifeArea.color }}
              />
              {note.lifeArea.name}
            </span>
          ) : null}
          {note.project ? (
            <span className="text-muted-foreground text-xs">{note.project.name}</span>
          ) : null}
          {note.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px]">
              {tag.name}
            </Badge>
          ))}
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Note actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => toggleNotePin(note.id),
                note.pinned ? "Note unpinned" : "Note pinned",
              )
            }
          >
            {note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {note.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => toggleNoteArchive(note.id),
                note.archived ? "Note restored" : "Note archived",
              )
            }
          >
            {note.archived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
            {note.archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => run(() => deleteNote(note.id), "Note deleted")}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
