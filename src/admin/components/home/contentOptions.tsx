// Shared pieces for picking movies / web series on the Home pages (banners + sections).
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface MovieOption {
  _id: string;
  movieTitle: string;
  releaseYear?: number | string;
  posterUrl?: string;
  publishStatus?: boolean;
}

export interface SeriesOption {
  _id: string;
  title: string;
  contentType?: string; // "webseries" | "tvshow"
  posterUrl?: string;
  isPublished?: boolean;
}

/** One picked item, the same shape for movies and series. */
export interface PickedItem {
  _id: string;
  title: string;
  posterUrl?: string;
  published: boolean;
  subtitle?: string;
}

export const urlOf = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  const u = (v as { url?: string }).url;
  return typeof u === "string" ? u : "";
};

export const seriesKindLabel = (contentType?: string) => (contentType === "tvshow" ? "TV show" : "Web series");

export const movieToItem = (m: MovieOption): PickedItem => ({
  _id: m._id,
  title: m.movieTitle || "Untitled movie",
  posterUrl: m.posterUrl,
  published: m.publishStatus !== false,
  subtitle: m.releaseYear ? String(m.releaseYear) : undefined,
});

export const seriesToItem = (s: SeriesOption): PickedItem => ({
  _id: s._id,
  title: s.title || "Untitled series",
  posterUrl: s.posterUrl,
  published: s.isPublished !== false,
  subtitle: seriesKindLabel(s.contentType),
});

export function useMovieOptions(enabled = true) {
  return useQuery({
    queryKey: ["movieOptions"],
    queryFn: async () => ((await api.get("/movies/options")).data.data || []) as MovieOption[],
    enabled,
  });
}

export function useSeriesOptions(enabled = true) {
  return useQuery({
    queryKey: ["seriesOptions"],
    queryFn: async () => ((await api.get("/webseries/options")).data.data || []) as SeriesOption[],
    enabled,
  });
}

export function Poster({ url, className }: { url?: string; className?: string }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded bg-muted", className || "h-12 w-8")}>
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Film className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

export function DraftBadge() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
      Draft – hidden in app
    </span>
  );
}
