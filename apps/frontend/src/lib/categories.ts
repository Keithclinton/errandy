import {
  ClipboardList,
  Wrench,
  Truck,
  Sparkles,
  ShoppingBasket,
  Briefcase,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export const TASK_CATEGORIES = [
  "Errands",
  "Home & Repairs",
  "Moving & Help",
  "Cleaning",
  "Shopping & Delivery",
  "Business Help",
  "Other",
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const CATEGORY_ICONS: Record<TaskCategory, LucideIcon> = {
  Errands: ClipboardList,
  "Home & Repairs": Wrench,
  "Moving & Help": Truck,
  Cleaning: Sparkles,
  "Shopping & Delivery": ShoppingBasket,
  "Business Help": Briefcase,
  Other: MoreHorizontal,
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category as TaskCategory] ?? MoreHorizontal;
}
