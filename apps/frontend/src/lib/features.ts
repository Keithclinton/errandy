/**
 * Features that are built but switched off until launch. To turn one on, set its variable to
 * "true" in Vercel (Settings → Environment Variables, Production) and redeploy.
 */
export const features = {
  /** The row of category pills (Errands, Cleaning, ...) above the task list on Browse. */
  commonCategories: import.meta.env.VITE_FEATURE_COMMON_CATEGORIES === "true",
};
