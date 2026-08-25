const SDK_URL = "https://cdn.usesmileid.com/inline/v12/js/script.min.js";

export interface SmileIdentityResult {
  status?: "success" | "failure" | "cancelled" | string;
  [key: string]: unknown;
}

export interface SmileIdentityConfig {
  token: string;
  product: string;
  callback_url: string;
  environment: "sandbox" | "production";
  partner_details: {
    partner_id: string;
    name: string;
    logo_url: string;
    policy_url: string;
    theme_color: string;
  };
  onResult: (result: SmileIdentityResult) => void;
}

declare global {
  interface Window {
    SmileIdentity?: (config: SmileIdentityConfig) => void;
  }
}

let loadPromise: Promise<void> | null = null;

/** Loads Smile ID's hosted v12 Web SDK script once, caching the promise across calls. */
export function loadSmileIdSdk(): Promise<void> {
  if (window.SmileIdentity) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load the verification widget. Check your connection and try again."));
    document.body.appendChild(script);
  });
  return loadPromise;
}
