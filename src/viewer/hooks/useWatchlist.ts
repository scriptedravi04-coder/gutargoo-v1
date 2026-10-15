// "My List" / Watchlist — saved on this device (the app keeps it only in memory; web keeps it).
import { useCallback, useEffect, useState } from "react";
import { storage, WatchlistEntry } from "@v/lib/storage";
import type { Item } from "@v/lib/content";

const EVENT = "gp-watchlist-changed";

export function useWatchlist() {
  const [list, setList] = useState<WatchlistEntry[]>(storage.getWatchlist());

  useEffect(() => {
    const sync = () => setList(storage.getWatchlist());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const save = (next: WatchlistEntry[]) => {
    storage.setWatchlist(next);
    setList(next);
    window.dispatchEvent(new Event(EVENT));
  };

  const has = useCallback((id: string) => list.some((x) => x.id === id), [list]);

  const toggle = useCallback(
    (it: Pick<Item, "id" | "kind" | "title" | "poster">) => {
      const cur = storage.getWatchlist();
      const exists = cur.some((x) => x.id === it.id);
      save(exists ? cur.filter((x) => x.id !== it.id) : [{ id: it.id, kind: it.kind, title: it.title, poster: it.poster }, ...cur]);
      return !exists;
    },
    []
  );

  const remove = useCallback((id: string) => save(storage.getWatchlist().filter((x) => x.id !== id)), []);

  return { list, has, toggle, remove };
}
