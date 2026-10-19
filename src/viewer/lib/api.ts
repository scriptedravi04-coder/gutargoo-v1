// Talks to the same backend the mobile app uses.
import axios, { AxiosError } from "axios";
import { API_URL } from "./config";
import { storage } from "./storage";

export const api = axios.create({ baseURL: "/api", timeout: 30000 });

// The website and the API normally run on the SAME server ("/api").
// VITE_API_URL is only used when this site has no API of its own.
let ownServer = false; // true → this server also plays videos at /stream (no browser blocking)
let streamHosts: string[] = []; // video hosts this server can play through /stream
type Health = { state: "ok" | "none" | "down"; body?: { app?: string; streamHosts?: string[] } };
const health = async (base: string): Promise<Health> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 6000);
    try {
      const r = await fetch(`${base}/health`, { cache: "no-store", signal: ctrl.signal });
      if (r.status === 404 || !(r.headers.get("content-type") || "").includes("json")) return { state: "none" };
      const j = await r.json();
      if (j && j.success) return { state: "ok", body: j };
    } catch {
      /* cold start / network blip → try again */
    } finally {
      window.clearTimeout(t);
    }
    await new Promise((res) => window.setTimeout(res, 800 * (attempt + 1)));
  }
  return { state: "down" };
};
export const serverReady: Promise<void> = (async () => {
  const here = await health("/api");
  if (here.state === "ok") {
    ownServer = here.body?.app === "gutargoo-one";
    streamHosts = (here.body?.streamHosts || []).map((h) => String(h).toLowerCase());
    return;
  }
  // only a site with NO api of its own uses VITE_API_URL
  if (here.state === "none" && API_URL && API_URL !== "/api") api.defaults.baseURL = API_URL;
})();

/** Video links from another domain (old server / Bunny CDN) → this server's /stream, so the browser doesn't block them. */
export function playableUrl(url: string): string {
  if (!ownServer || !url) return url;
  try {
    const u = new URL(url, window.location.href);
    if (u.host === window.location.host || !streamHosts.includes(u.host.toLowerCase())) return url; // other links stay as they are
    const path = u.pathname.startsWith("/stream/") ? u.pathname : `/stream${u.pathname}`;
    return `${window.location.origin}${path}${u.search}`;
  } catch {
    return url;
  }
}

api.interceptors.request.use(async (config) => {
  await serverReady;
  config.baseURL = api.defaults.baseURL;
  const token = storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Expired / blocked login → sign out quietly (public pages keep working)
api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const url = error.config?.url || "";
    const msg = String((error.response?.data as { message?: string } | undefined)?.message || "");
    const blocked = error.response?.status === 403 && /blocked/i.test(msg);
    if ((error.response?.status === 401 || blocked) && storage.getToken() && !url.includes("/otp/")) {
      storage.clearAuth();
      storage.setProfile({}); // same as signing out: the next person on this device starts clean
      window.dispatchEvent(new Event("gp-auth-changed"));
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  const e = err as AxiosError<{ message?: string }>;
  const status = e?.response?.status;
  const msg = e?.response?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (status === 429) {
    const wait = Number(e.response?.headers?.["retry-after"]);
    return wait > 0
      ? `Too many attempts. Please try again in ${wait >= 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`}.`
      : "Too many attempts. Please wait a few minutes and try again.";
  }
  if (e?.code === "ECONNABORTED" || /timeout/i.test(e?.message || "")) return "The server is taking too long. Please try again.";
  if (e?.message === "Network Error" || (e?.request && !e?.response)) return "No internet connection. Please check your network and try again.";
  if (status && status >= 500) return "Server problem. Please try again in a moment.";
  return fallback;
};

/* ───────── Raw API shapes (only the fields we use) ───────── */

export interface ApiImage {
  url?: string;
}

export interface ApiVideo {
  url?: string;
  hlsUrl?: string;
  videoId?: string;
  status?: number;
  duration?: number;
  thumbnailUrl?: string;
}

export interface ApiPerson {
  _id?: string;
  name: string;
  role?: string;
  character?: string;
  imageUrl?: string;
}

export interface ApiMovie {
  _id: string;
  movieTitle: string;
  description?: string;
  fullStoryline?: string;
  genres?: string[];
  lang?: string;
  ageRating?: string;
  imdbRating?: number;
  releaseYear?: number;
  duration?: number; // minutes
  subscriptionRequired?: boolean;
  allowDownloads?: boolean;
  videoStreamUrl?: string | null;
  customVideoUrl?: string;
  trailerStreamUrl?: string | null;
  logoUrl?: string;
  verticalPosterUrl?: string;
  horizontalBannerUrl?: string;
  bigVerticalUrl?: string;
  movieFile?: ApiVideo;
  skipIntro?: { start?: number; end?: number };
  crew?: ApiPerson[];
  cast?: ApiPerson[];
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiEpisode {
  _id: string;
  title: string;
  description?: string;
  episodeNumber: number;
  isPublished?: boolean;
  thumbnail?: string;
  videoFile?: ApiVideo;
  videoStreamUrl?: string | null;
  customVideoUrl?: string;
  skipIntro?: { start?: number; end?: number };
  /** set by fromSeries() (web only): playable link, or null while the video isn't ready */
  webPlay?: string | null;
}

export interface ApiSeason {
  _id: string;
  seasonNumber: number;
  title?: string;
  episodes: ApiEpisode[];
}

export interface ApiSeries {
  _id: string;
  title: string;
  description?: string;
  genres?: string[];
  lang?: string;
  ageRating?: string;
  imdbRating?: number;
  type?: "webseries" | "tvshow";
  contentType?: "webseries" | "tvshow";
  subscriptionRequired?: boolean;
  verticalPoster?: string;
  horizontalBanner?: string;
  thumbnail?: string;
  trailerStreamUrl?: string | null;
  seasons?: ApiSeason[];
  updatedAt?: string;
  total_seasons?: number;
  total_episodes?: number;
  viewCount?: number;
  castAndCrew?: { _id: string; personName?: string; role?: string; characterName?: string; profileImage?: ApiImage }[];
}

export interface ApiSectionItem {
  _id: string;
  type: "movie" | "webseries" | "tvshow";
}

export interface ApiSection {
  _id: string;
  title: string;
  displayStyle?: string;
  displayOrder?: number;
  isActive?: boolean;
  sectionData?: ApiSectionItem[];
}

export interface ApiBanner {
  _id: string;
  title: string;
  bannerImage?: string;
  mobileImage?: string;
  logoImage?: string;
  bannerType?: string;
  movieId?: { _id: string } | string | null;
  webseriesId?: { _id: string } | string | null;
  genres?: string[];
  language?: string;
  categoryId?: { _id: string; name?: string; categoryType?: string } | null;
}

export interface ApiCategory {
  _id: string;
  name: string;
  categoryType?: string;
}

export interface ApiPopup {
  _id: string;
  title?: string;
  image?: string;
  link?: string;
  isActive?: boolean;
}
