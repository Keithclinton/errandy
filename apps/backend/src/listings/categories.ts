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
