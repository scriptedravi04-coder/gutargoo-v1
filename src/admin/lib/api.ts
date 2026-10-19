// One place for every call to the backend.
// Base URL comes from VITE_BACKEND_URL (e.g. https://admin.gutargooplus.com/api).
import axios, { AxiosError } from "axios";

export const TOKEN_KEY = "auth_token";
export const USER_KEY = "auth_user";

// This project serves the admin panel and the API from the SAME server, so "/api" is used.
// VITE_BACKEND_URL is only a fallback for a build that is hosted without the API next to it.
const ENV_BASE = String(import.meta.env.VITE_BACKEND_URL || "").trim().replace(/\/+$/, "");
export let API_BASE_URL = "/api";

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 120000 });

export interface ServerInfo {
  base: string;
  /** "gutargoo-one" when this is the new server; "" for an old/unknown server */
  app: string;
  ok: boolean;
}

/**
 * "ok" = server answered; "none" = there is no API here at all (404, or a normal 200 web page instead of JSON);
 * "down" = no good answer right now (network error, 5xx, …) — never a reason to switch to another server
 */
const health = async (base: string): Promise<{ state: "ok" | "none" | "down"; app: string }> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(`${base}/health`, { cache: "no-store", signal: ctrl.signal });
      const type = r.headers.get("content-type") || "";
      const isJson = type.includes("json");
      if (r.status === 404) return { state: "none", app: "" };
      if (r.status === 200 && !isJson) return { state: "none", app: "" };
      if (r.ok && isJson) {
        const j = await r.json().catch(() => null);
        if (j && j.success) return { state: "ok", app: String(j.app || "") };
      }
      // 5xx / other → server is there but not healthy right now → retry, then "down"
    } catch {
      /* cold start / network blip → try again */
    } finally {
      window.clearTimeout(t);
    }
    await new Promise((res) => window.setTimeout(res, 800 * (attempt + 1)));
  }
  return { state: "down", app: "" };
};

/** Finds the API once: this server's /api. Only when this site has NO api at all, VITE_BACKEND_URL is used. */
export const serverReady: Promise<ServerInfo> = (async () => {
  const here = await health("/api");
  if (here.state === "ok") return { base: "/api", app: here.app, ok: true };
  if (here.state === "none" && ENV_BASE && ENV_BASE !== "/api") {
    API_BASE_URL = ENV_BASE;
    api.defaults.baseURL = ENV_BASE;
    const there = await health(ENV_BASE);
    return { base: ENV_BASE, app: there.app, ok: there.state === "ok" };
  }
  return { base: "/api", app: "", ok: false };
})();

api.interceptors.request.use(async (config) => {
  await serverReady;
  config.baseURL = api.defaults.baseURL;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // saving with images (multipart) can take long on a slow connection → allow up to 10 minutes
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.timeout = Math.max(config.timeout || 0, 10 * 60 * 1000);
  }
  return config;
});

const goToLogin = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (window.location.pathname !== "/admin/login") window.location.href = "/admin/login";
};

// One "am I still logged in?" check shared by all failing requests
let meCheck: Promise<boolean> | null = null;
const stillLoggedIn = () => {
  if (!meCheck) {
    meCheck = api
      .get("/auth/me")
      .then(() => true)
      .catch((e: AxiosError) => e.response?.status !== 401)
      .finally(() => window.setTimeout(() => (meCheck = null), 3000));
  }
  return meCheck;
};

// 401 → only log out when the login itself is really gone (checked with /auth/me).
// A single page answering 401 shows an error instead of throwing you out.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/login")) {
      if (url.includes("/auth/me") || !localStorage.getItem(TOKEN_KEY)) goToLogin();
      else if (!(await stillLoggedIn())) goToLogin();
      else {
        const d = error.response.data;
        (error.response as { data: unknown }).data = {
          ...(d && typeof d === "object" ? d : {}),
          message: `The server refused this (${url}). You are still logged in — please try again, or check the server version on the Dashboard.`,
        };
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from any API error. */
export const errorMessage = (err: unknown, fallback = "Something went wrong"): string => {
  const e = err as AxiosError<{ message?: string; error?: string }>;
  // the web server / proxy refused the upload size (often an HTML page, not our JSON)
  if (e?.response?.status === 413) return "Files too big — use smaller images (under 5 MB each)";
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT") {
    return e?.config?.data instanceof FormData
      ? "The server took too long to answer. It may have saved anyway — refresh the list and check before trying again."
      : "The server took too long to answer. Please try again.";
  }
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

/**
 * A saved "custom link" that is just the Bunny link of the item's own uploaded video is not a real
 * custom link (old data stored it that way) → show it empty, so a new upload is never hidden behind it.
 */
export const realCustomLink = (url?: string | null, video?: { videoId?: string } | null): string => {
  if (!url) return "";
  if (video?.videoId && url.includes(video.videoId)) return "";
  return url;
};
