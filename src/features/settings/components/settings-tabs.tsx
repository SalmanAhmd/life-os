"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/schedule", label: "Schedule" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/life-areas", label: "Life areas" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/60" aria-label="Settings sections">
      <ul className="flex flex-wrap gap-1 px-2" role="tablist">
        {SETTINGS_TABS.map((tab) => (
          <li key={tab.href} role="presentation">
            <Link
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                pathname === tab.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              aria-selected={pathname === tab.href}
              role="tab"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}