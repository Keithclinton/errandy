/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "true" shows the category pills on Browse. Off until launch; see src/lib/features.ts. */
  readonly VITE_FEATURE_COMMON_CATEGORIES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
