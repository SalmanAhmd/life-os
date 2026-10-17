import {
  BarChart3,
  Calendar,
  CalendarRange,
  CircleCheck,
  FileText,
  Flag,
  Home,
  LayoutGrid,
  NotebookPen,
  Repeat,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/today", label: "Today", icon: CircleCheck },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/timetable", label: "Timetable", icon: CalendarRange },
      { href: "/tasks", label: "Tasks", icon: LayoutGrid },
      { href: "/projects", label: "Projects", icon: FileText },
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/habits", label: "Habits", icon: Repeat },
    ],
  },
  {
    label: "Reflect",
    items: [
      { href: "/notes", label: "Notes", icon: NotebookPen },
      { href: "/journal", label: "Journal", icon: Sparkles },
      { href: "/rewards", label: "Rewards", icon: Trophy },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/profile", label: "Profile", icon: User },
      { href: "/settings/life-areas", label: "Life areas", icon: Flag },
      { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
      { href: "/settings/schedule", label: "Schedule", icon: Settings },
      { href: "/settings/notifications", label: "Notifications", icon: Settings },
    ],
  },
];

/** Flat list for the command palette. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
