// Loads everything the home screen needs (same calls as the mobile app) and links it together.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiBanner, ApiCategory, ApiMovie, ApiSection, ApiSeries } from "@v/lib/api";
import { categoryKind, fromMovie, fromSeries, Item, Kind } from "@v/lib/content";
import { SHOW_PAID_WITH_LOCK } from "@v/lib/config";

export interface Section {
  id: string;
  title: string;
  style: string;
  items: Item[];
}

export interface Banner {
  id: string;
  title: string;
  image: string; // tall picture (phones)
  wide: string; // landscape picture (laptop / TV)
  logo: string;
  item: Item | null;
  kind: Kind;
  genres: string[];
  lang: string;
}

export interface Category {
  id: string;
  name: string;
  kind: Kind | null; // null = "Home" (everything)
}

const FIVE_MIN = 5 * 60 * 1000;
const get = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => (await api.get(url, { params })).data;

export const useMovies = () =>
  useQuery({ queryKey: ["movies"], queryFn: () => get<{ data: ApiMovie[] }>("/movies"), staleTime: FIVE_MIN });
export const useSeriesList = () =>
  useQuery({ queryKey: ["webseries"], queryFn: () => get<{ data: ApiSeries[] }>("/webseries"), staleTime: FIVE_MIN });

const url = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" ? String((v as { url?: string }).url || "") : "").trim();

/** The banner's title isn't in the movie / series lists (e.g. not loaded yet, or only linked from a banner):
 *  build a small item from what the banner itself carries so the banner still shows and opens the title. */
function bannerItem(b: ApiBanner, id: string): Item | null {
  const ws = b.webseriesId && typeof b.webseriesId === "object" ? (b.webseriesId as unknown as ApiSeries) : null;
  if (ws) return fromSeries(ws);
  const m = (b.movieId && typeof b.movieId === "object" ? b.movieId : {}) as Record<string, unknown>;
  const poster = url(m.verticalPoster);
  const wide = url(m.horizontalBanner);
  const isSeries = b.bannerType === "web_series";
  return {
    id,
    kind: isSeries ? "webseries" : "movie",
    title: String(m.movieTitle || b.title || ""),
    poster: poster || wide,
    banner: wide || poster,
    bigVertical: poster,
    logo: "",
    genres: Array.isArray(m.genres) ? (m.genres as string[]) : b.genres || [],
    lang: String(m.lang || b.language || ""),
    imdb: Number(m.imdbRating) || 0,
    age: String(m.ageRating || ""),
    year: Number(m.releaseYear) || undefined,
    description: String(m.description || ""),
    isFree: true, // unknown here — the details page checks and shows "app only" when needed
    playUrl: null, // → "Watch Now" opens the details page, which knows how to play it
    trailerUrl: null,
    people: [],
    seasons: [],
    views: 0,
  };
}

export function useCatalog() {
  const movies = useMovies();
  const series = useSeriesList();
  const sections = useQuery({
    queryKey: ["sections"],
    queryFn: () => get<{ data: ApiSection[] }>("/admin/sections/allList"),
    staleTime: FIVE_MIN,
  });
  const banners = useQuery({
    queryKey: ["banners"],
    queryFn: () => get<{ data: ApiBanner[] }>("/banners", { limit: 20 }),
    staleTime: FIVE_MIN,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => get<{ data: ApiCategory[] }>("/category"),
    staleTime: FIVE_MIN,
  });

  const data = useMemo(() => {
    const allMovies = (movies.data?.data || []).map(fromMovie);
    const allSeries = (series.data?.data || []).map(fromSeries);
    const visible = (it: Item) => SHOW_PAID_WITH_LOCK || it.isFree;
    const byId = new Map<string, Item>();
    for (const it of [...allMovies, ...allSeries]) if (visible(it)) byId.set(it.id, it);

    const sectionList: Section[] = (sections.data?.data || [])
      .filter((s) => s.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map((s) => ({
        id: s._id,
        title: s.title,
        style: s.displayStyle || "vertical_banner",
        items: (s.sectionData || [])
          .map((ref) => {
            const it = byId.get(String(ref._id));
            if (!it) return null;
            // the section decides whether a series shows under TV Shows or Web Series
            return ref.type === "tvshow" && it.kind !== "movie" ? { ...it, kind: "tvshow" as Kind } : it;
          })
          .filter(Boolean) as Item[],
      }))
      .filter((s) => s.items.length > 0);

    const idOf = (v: ApiBanner["movieId"]) => (v && typeof v === "object" ? v._id : v || null);
    const bannerList: Banner[] = (banners.data?.data || [])
      .map((b) => {
        const id = idOf(b.webseriesId) || idOf(b.movieId);
        const item = id ? byId.get(String(id)) || bannerItem(b, String(id)) : null;
        return {
          id: b._id,
          title: b.title,
          image: b.mobileImage || b.bannerImage || item?.banner || "",
          wide: b.bannerImage || item?.banner || b.mobileImage || "",
          logo: b.logoImage || item?.logo || "",
          item,
          kind: item?.kind || (b.bannerType === "web_series" ? "webseries" : "movie"),
          genres: item?.genres?.length ? item.genres : b.genres || [],
          lang: item?.lang || b.language || "",
        } as Banner;
      })
      .filter((b) => b.image && b.item);

    const cats: Category[] = [
      { id: "home", name: "Home", kind: null },
      ...(categories.data?.data || [])
        .map((c) => ({ id: c._id, name: c.name, kind: categoryKind(c.categoryType, c.name) }))
        .filter((c) => c.kind !== null),
    ];

    // every title, de-duplicated (used for "Explore More", search and "Recommended")
    const everything: Item[] = [];
    const seen = new Set<string>();
    for (const s of sectionList) for (const it of s.items) if (!seen.has(it.id)) (seen.add(it.id), everything.push(it));
    for (const it of byId.values()) if (!seen.has(it.id)) (seen.add(it.id), everything.push(it));

    return { sections: sectionList, banners: bannerList, categories: cats, byId, everything };
  }, [movies.data, series.data, sections.data, banners.data, categories.data]);

  const loading = movies.isLoading || series.isLoading || sections.isLoading;
  // any list failing counts; pages show a full error only when nothing could be shown,
  // otherwise a small "some titles didn't load — Retry" line
  const error = movies.error || sections.error || series.error;
  const refetch = () => Promise.all([movies.refetch(), series.refetch(), sections.refetch(), banners.refetch(), categories.refetch()]);

  return { ...data, loading, error, refetch };
}
