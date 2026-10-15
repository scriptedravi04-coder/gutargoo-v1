// Talks to the same backend the mobile app uses.
import axios, { AxiosError } from "axios";
import { API_URL } from "./config";
import { storage } from "./storage";

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
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
      window.dispatchEvent(new Event("gp-auth-changed"));
    }
    return Promise.reject(error);
  }
);

export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  const e = err as AxiosError<{ message?: string }>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message === "Network Error") return "No internet connection.";
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
