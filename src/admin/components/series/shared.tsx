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
  thumbnail?: string; // URL string (server formats it)
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

/** "2024-05-01T00:00:00.000Z" → "2024-05-01" for <input type="date"> */
export const toDateInput = (d?: string | null) => {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

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
