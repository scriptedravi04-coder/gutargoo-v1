// One place for every call to the backend.
// Base URL comes from VITE_BACKEND_URL (e.g. https://admin.gutargooplus.com/api).
import axios, { AxiosError } from "axios";

export const TOKEN_KEY = "auth_token";
export const USER_KEY = "auth_user";

// Same server as the website, so "/api" works everywhere (VITE_BACKEND_URL can override)
export const API_BASE_URL: string = import.meta.env.VITE_BACKEND_URL || "/api";

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 120000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Logged out / token expired → back to the login page
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/admin/login") window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from any API error. */
export const errorMessage = (err: unknown, fallback = "Something went wrong"): string => {
  const e = err as AxiosError<{ message?: string; error?: string }>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.code === "ECONNABORTED") return "The server took too long to answer. Please try again.";
  if (e?.message === "Network Error") return "Cannot reach the server. Check your internet connection.";
  return (e as Error)?.message || fallback;
};

/** Build multipart form data. Arrays/objects are sent as JSON, File as file, undefined skipped. */
export const toFormData = (values: Record<string, unknown>): FormData => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (value instanceof File) fd.append(key, value);
    else if (value === null) fd.append(key, "");
    else if (Array.isArray(value) || typeof value === "object") fd.append(key, JSON.stringify(value));
    else fd.append(key, String(value));
  }
  return fd;
};

// ───────── Shared types ─────────
export interface ImageRef {
  url?: string;
  publicId?: string;
}

export interface VideoRef {
  url?: string;
  videoId?: string;
  hlsUrl?: string;
  mp4Url?: string;
  thumbnailUrl?: string;
  duration?: number;
  status?: number; // Bunny: 4 = ready, 5/6 = failed, others = processing
}

export const videoStatusLabel = (v?: VideoRef | null): { label: string; tone: "ok" | "wait" | "bad" | "none" } => {
  if (!v || !v.videoId) return v?.hlsUrl || v?.url ? { label: "Link", tone: "ok" } : { label: "No video", tone: "none" };
  if (v.status === 4) return { label: "Ready", tone: "ok" };
  if (v.status === 5 || v.status === 6) return { label: "Failed", tone: "bad" };
  return { label: "Processing", tone: "wait" };
};
