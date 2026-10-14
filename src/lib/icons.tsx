import {
  Activity,
  Award,
  Book,
  Briefcase,
  Circle,
  Code,
  Coffee,
  DollarSign,
  Dumbbell,
  Flame,
  GraduationCap,
  Heart,
  Home,
  Leaf,
  Music,
  Plane,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  circle: Circle,
  home: Home,
  briefcase: Briefcase,
  heart: Heart,
  activity: Activity,
  dumbbell: Dumbbell,
  book: Book,
  graduation: GraduationCap,
  code: Code,
  target: Target,
  star: Star,
  leaf: Leaf,
  coffee: Coffee,
  music: Music,
  plane: Plane,
  users: Users,
  money: DollarSign,
  award: Award,
  flame: Flame,
  sparkles: Sparkles,
};

export const ICON_NAMES = Object.keys(ICON_REGISTRY);

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Circle;
  return ICON_REGISTRY[name] ?? Circle;
}
