"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_GROUPS } from "@/components/app-shell/nav-config";
import { cn } from "@/lib/utils";

export function NavLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 px-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed ? (
            <p className="text-muted-foreground px-2 py-1 text-xs font-medium tracking-wide uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
