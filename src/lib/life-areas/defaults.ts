/**
 * Starter life areas created for every new account. Users can rename,
 * recolour, reorder, archive, or add their own from Settings → Life areas.
 */
export interface DefaultLifeArea {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_LIFE_AREAS: DefaultLifeArea[] = [
  { name: "Career", color: "#6366f1", icon: "briefcase" },
  { name: "Health", color: "#10b981", icon: "heart-pulse" },
  { name: "Family", color: "#f59e0b", icon: "users" },
  { name: "Faith", color: "#8b5cf6", icon: "moon-star" },
  { name: "Finance", color: "#0ea5e9", icon: "wallet" },
  { name: "Learning", color: "#ec4899", icon: "graduation-cap" },
  { name: "Personal", color: "#64748b", icon: "circle-user" },
];
