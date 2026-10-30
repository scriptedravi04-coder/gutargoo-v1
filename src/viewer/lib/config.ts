// Web app settings
export const API_URL: string = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
// server fills window.__GG from GG_ENV (PLAY_STORE_URL / APP_STORE_URL) — no rebuild needed
const RUN = ((typeof window !== "undefined" && (window as unknown as { __GG?: Record<string, string> }).__GG) || {}) as Record<string, string>;
export const PLAY_STORE_URL: string =
  RUN.playStoreUrl || import.meta.env.VITE_PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=com.gutargooproo.application";
export const APP_STORE_URL: string = RUN.appStoreUrl || import.meta.env.VITE_APP_STORE_URL || "";
export const SUPPORT_EMAIL = "support@gutargooplus.com";

// Web shows FREE content only. Paid (subscription) titles are shown with a lock and send people to the app.
// Set to false to hide paid titles from the web completely.
export const SHOW_PAID_WITH_LOCK = true;
