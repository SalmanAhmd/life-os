"use client";

import { Moon, Plus, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_GROUPS } from "@/components/app-shell/nav-config";

export interface CommandAction {
  id: string;
  label: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: CommandAction[];
}) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {actions.length > 0 ? (
          <>
            <CommandGroup heading="Actions">
              {actions.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => {
                    onOpenChange(false);
                    action.run();
                  }}
                >
                  <Plus className="size-4" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        {NAV_GROUPS.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${group.label} ${item.label}`}
                onSelect={() => go(item.href)}
              >
                <item.icon className="size-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem
            onSelect={() => {
              setTheme("light");
              onOpenChange(false);
            }}
          >
            <Sun className="size-4" />
            Light theme
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme("dark");
              onOpenChange(false);
            }}
          >
            <Moon className="size-4" />
            Dark theme
          </CommandItem>
          {mounted ? (
            <CommandItem
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                onOpenChange(false);
              }}
            >
              Toggle theme
            </CommandItem>
          ) : null}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
