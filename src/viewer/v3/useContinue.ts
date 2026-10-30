// Continue watching for v3: the account's movies (server) + episodes / guest movies kept on this device.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiMovie } from "@v/lib/api";
import { fromMovie, Item } from "@v/lib/content";
import { storage } from "@v/lib/storage";
import { useAuth } from "@v/lib/auth";
import { leftText } from "./ui";

export interface CwCard {
  id: string;
  item: Item;
  img: string;
  title: string;
  pct: number; // 0..100
  badge: string; // "S1 E3"
  sub: string; // "24m left · 3 more episodes"
  path: string; // resume link
  leftSec: number;
}

interface CwRow {
  movie: ApiMovie;
  watchedTime: number;
  duration: number;
}

export function useContinue(byId: Map<string, Item>) {
  const { token, isLoggedIn } = useAuth();
  const { data } = useQuery({
    queryKey: ["continue-watching", "v3", token], // own cache entry: the desktop row stores a different shape
    enabled: isLoggedIn,
    queryFn: async () => { const d = (await api.get<{ data: CwRow[] }>("/continue-watching")).data?.data; return Array.isArray(d) ? d : []; },
  });

  return useMemo<CwCard[]>(() => {
    const out: CwCard[] = [];
    const have = new Set<string>();
    for (const r of isLoggedIn && Array.isArray(data) ? data : []) {
      if (!r?.movie?._id) continue;
      const it = byId.get(r.movie._id) || fromMovie(r.movie);
      const total = r.duration || (it.durationMin ? it.durationMin * 60 : 0);
      const w = Math.max(0, Math.floor(r.watchedTime || 0));
      if (total && w >= total - 20) continue;
      have.add(it.id);
      out.push({
        id: it.id,
        item: it,
        img: it.banner || it.poster,
        title: it.title,
        pct: total ? Math.min(100, (w / total) * 100) : 0,
        badge: "",
        sub: total ? leftText(total - w) : "Resume",
        path: `/watch/movie/${it.id}?t=${w}`,
        leftSec: total ? total - w : 0,
      });
    }
    for (const l of storage.getLocalCw()) {
      if (have.has(l.id) || (l.kind === "movie" && isLoggedIn)) continue;
      const full = byId.get(l.id);
      const it = full || ({ id: l.id, kind: l.kind, title: l.title, banner: l.banner, poster: l.banner, isFree: l.free, genres: [], seasons: [] } as unknown as Item);
      let sub = l.d > 0 ? leftText(l.d - l.t) : "Resume";
      if (l.kind !== "movie" && full) {
        const eps = full.seasons.flatMap((s) => [...(s.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber));
        const i = eps.findIndex((e) => e._id === l.epId);
        const more = i >= 0 ? eps.length - i - 1 : 0;
        sub += more > 0 ? ` · ${more} more episode${more === 1 ? "" : "s"}` : i >= 0 ? " · Finale" : "";
      }
      out.push({
        id: l.id,
        item: it,
        img: it.banner || l.banner,
        title: it.title || l.title,
        pct: l.d > 0 ? Math.min(100, (l.t / l.d) * 100) : 0,
        badge: l.kind !== "movie" ? l.epLabel || "" : "",
        sub,
        path: l.kind === "movie" ? `/watch/movie/${l.id}?t=${l.t}` : `/watch/series/${l.id}?ep=${l.epId || ""}${l.t ? `&t=${l.t}` : ""}`,
        leftSec: l.d > 0 ? l.d - l.t : 0,
      });
    }
    return out;
    // storage is read fresh whenever the server list or catalog changes
  }, [data, isLoggedIn, byId]);
}

/** resume info for one title (labels on Home hero / Detail CTA) */
export function resumeFor(cards: CwCard[], id: string) {
  return cards.find((c) => c.id === id) || null;
}
