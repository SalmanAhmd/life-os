"use client";

import { Bell, Command, Menu, PanelLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { CommandPalette } from "@/components/app-shell/command-palette";
import { NavLinks } from "@/components/app-shell/nav-links";
import { UserMenu } from "@/components/app-shell/user-menu";
import { ThemeToggle } from "@/components/app-shell/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "lifeos.sidebar.collapsed";

export interface ShellUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-svh w-full">
      <aside
        className={cn(
          "border-border/60 bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-14 items-center gap-2 px-3">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <Command className="size-4" />
          </div>
          {!collapsed ? <span className="font-semibold">Life OS</span> : null}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks collapsed={collapsed} />
        </div>
        <div className="border-border/60 border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full gap-2", collapsed && "justify-center px-0")}
            onClick={() => setCollapsed((value) => !value)}
          >
            <PanelLeft className="size-4" />
            {!collapsed ? "Collapse" : null}
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Primary navigation</SheetDescription>
          </SheetHeader>
          <div className="flex h-14 items-center gap-2 px-3">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <Command className="size-4" />
            </div>
            <span className="font-semibold">Life OS</span>
          </div>
          <div className="overflow-y-auto py-2">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border/60 bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="text-muted-foreground border-border/60 bg-muted/40 hover:bg-muted hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border px-3 text-sm transition-colors md:flex"
          >
            <Search className="size-4" />
            <span>Search…</span>
            <kbd className="bg-background ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-4" />
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-4" />
            </Button>
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
