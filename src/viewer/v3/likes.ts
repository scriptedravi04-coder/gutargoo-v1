// Like state for any title: movies + signed in → the account (same as the app), otherwise this device.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@v/lib/api";
import { storage } from "@v/lib/storage";
import { useAuth } from "@v/lib/auth";
import type { Item } from "@v/lib/content";

export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

export function useLike(item: Pick<Item, "id" | "kind"> | null, withCount = false) {
  const { isLoggedIn } = useAuth();
  const qc = useQueryClient();
  const id = item?.id || "";
  const isMovie = item?.kind === "movie";
  const server = isLoggedIn && isMovie;
  const [liked, setLiked] = useState(() => !!id && storage.getLikes().includes(id));
  useEffect(() => setLiked(!!id && storage.getLikes().includes(id)), [id]);

  useEffect(() => {
    if (!server || !id) return;
    let alive = true;
    api
      .get<{ liked?: boolean }>(`/movie-likes/${id}/check`)
      .then((r) => alive && typeof r.data?.liked === "boolean" && setLiked(r.data.liked))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [server, id]);

  const count = useQuery({
    queryKey: ["likes-count", id],
    enabled: withCount && isMovie && !!id,
    queryFn: async () => Number((await api.get<{ totalLikes?: number }>(`/movie-likes/${id}`)).data?.totalLikes) || 0,
    staleTime: 60 * 1000,
  });

  const saveLocal = (on: boolean) => {
    const cur = storage.getLikes().filter((x) => x !== id);
    storage.setLikes(on ? [...cur, id] : cur);
  };

  const toggle = () => {
    if (!id) return false;
    const next = !liked;
    setLiked(next);
    saveLocal(next);
    if (typeof count.data === "number") qc.setQueryData(["likes-count", id], Math.max(0, count.data + (next ? 1 : -1)));
    if (server) {
      api
        .post<{ liked?: boolean }>(`/movie-likes/${id}`)
        .then((r) => {
          if (typeof r.data?.liked === "boolean" && r.data.liked !== next) {
            setLiked(r.data.liked);
            saveLocal(r.data.liked);
          }
          qc.invalidateQueries({ queryKey: ["likes-count", id] });
        })
        .catch(() => {
          setLiked(!next);
          saveLocal(!next);
        });
    }
    return next;
  };

  return { liked, toggle, count: typeof count.data === "number" ? count.data : null };
}

export async function shareTitle(it: Pick<Item, "id" | "kind" | "title">, toast: (m: string) => void) {
  const url = `${window.location.origin}${it.kind === "movie" ? "/movie/" : "/series/"}${it.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: it.title, text: `Watch ${it.title} on Gutargoo+`, url });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    // older browsers / non-https: hidden textarea copy
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "Link copied" : url);
    } catch {
      toast(url);
    }
  }
}
