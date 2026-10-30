// Shared types and helpers for the Web Series / TV Shows pages.
import { api } from "@/lib/api";

export type SeriesContentType = "webseries" | "tvshow";

export interface EpisodeVideo {
  url?: string;
  hlsUrl?: string;
  status?: number;
  videoId?: string;
  duration?: number;
  thumbnailUrl?: string;
}

export interface Episode {
  _id: string;
  title: string;
  description?: string;
  episodeNumber: number;
  releaseDate?: string;
  isPublished?: boolean;
  thumbnail?: string; // URL string (server formats it; falls back to a video frame)
  thumbnailRaw?: string; // only the uploaded episode image ("" when none)
  videoFile?: EpisodeVideo;
  customVideoUrl?: string;
  skipIntro?: { start?: number; end?: number };
}

export interface Season {
  _id: string;
  seasonNumber: number;
  title?: string;
  releaseDate?: string;
  episodes: Episode[];
}

export interface PersonRef {
  _id: string;
  personName?: string;
  role?: string;
  profileImage?: { url?: string };
}

export interface Series {
  _id: string;
  title: string;
  description?: string;
  genres?: string[];
  lang?: string;
  ageRating?: string;
  imdbRating?: number;
  releaseDate?: string;
  contentType?: SeriesContentType;
  isPublished?: boolean;
  subscriptionRequired?: boolean;
  // populated object on GET, plain id in replies to save calls
  category?: string | { _id: string; name?: string } | null;
  castAndCrew?: (string | PersonRef)[];
  verticalPoster?: string;
  horizontalBanner?: string;
  thumbnail?: string;
  // images exactly as uploaded (newer servers); the keys above fall back to each other
  verticalPosterRaw?: string;
  thumbnailRaw?: string;
  horizontalBannerRaw?: string;
  trailer?: { url?: string; videoId?: string; status?: number; duration?: number } | null;
  customTrailerUrl?: string;
  seasons?: Season[];
  total_seasons?: number;
  total_episodes?: number;
}

export const seriesListKey = (contentType: SeriesContentType) => ["webseries", "list", contentType];
export const seriesDetailKey = (id: string) => ["webseries", "detail", id];

export const fetchSeries = async (id: string): Promise<Series> => {
  const { data } = await api.get(`/webseries/${id}`);
  return data.data as Series;
};

export const seriesLabels = (contentType: SeriesContentType) =>
  contentType === "tvshow"
    ? { base: "/tv-shows", one: "TV show", One: "TV show", many: "TV shows", Many: "TV Shows" }
    : { base: "/web-series", one: "web series", One: "Web series", many: "web series", Many: "Web Series" };

/** "2024-05-01T18:30:00.000Z" → "2024-05-02" (the admin's local date) for <input type="date"> */
export const toDateInput = (d?: string | null) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Newer servers send the raw uploaded image; older ones only the value with fallbacks. */
export const rawImage = (raw: string | undefined, fallback: string | undefined) =>
  (raw !== undefined ? raw : fallback) || undefined;

export const idOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  return (v as { _id?: string })._id || "";
};

/** seconds → "12:05" or "1:02:05" */
export const formatDuration = (sec?: number) => {
  if (!sec || sec <= 0) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** true when some episode video or the trailer is still being processed by Bunny */
export const hasProcessingVideo = (s?: Series | null) => {
  if (!s) return false;
  const processing = (v?: { videoId?: string; status?: number } | null) =>
    !!v?.videoId && v.status !== 4 && v.status !== 5 && v.status !== 6;
  if (processing(s.trailer)) return true;
  return (s.seasons || []).some((season) => (season.episodes || []).some((e) => processing(e.videoFile)));
};

export const isValidUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/** Bunny video ids of this series that are still processing (trailer + episodes), newest episodes first */
export const processingVideoIds = (s?: Series | null, max = 15): string[] => {
  if (!s) return [];
  const out: string[] = [];
  const add = (v?: { videoId?: string; status?: number } | null) => {
    if (v?.videoId && v.status !== 4 && v.status !== 5 && v.status !== 6 && !out.includes(v.videoId)) out.push(v.videoId);
  };
  add(s.trailer);
  for (const season of [...(s.seasons || [])].reverse()) for (const e of [...(season.episodes || [])].reverse()) add(e.videoFile);
  return out.slice(0, max);
};

/**
 * Ask Bunny now for every still-processing video of this series (the server saves the new status).
 * Needed because the automatic background check does not run reliably on every host.
 */
export const syncProcessingVideos = async (s?: Series | null): Promise<number> => {
  const ids = processingVideoIds(s);
  if (!ids.length) return 0;
  await Promise.allSettled(ids.map((id) => api.get(`/admin/bunny/videos/${encodeURIComponent(id)}`)));
  return ids.length;
};
