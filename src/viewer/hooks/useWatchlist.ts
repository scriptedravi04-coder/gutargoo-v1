// "My List" — kept on this device, and for signed-in users synced to the account
// (guests' saves are merged into the account when they log in).
import { useCallback, useEffect, useState } from "react";
import { storage, WatchlistEntry } from "@v/lib/storage";
import type { Item } from "@v/lib/content";
import { api } from "@v/lib/api";

const EVENT = "gp-watchlist-changed";

/* ── account sync ── */
let syncedToken: string | null = null;
let pushTimer: number | undefined;
const notify = () => window.dispatchEvent(new Event(EVENT));

let pending = false; // a local change is on its way to the account
function push() {
  window.clearTimeout(pushTimer);
  pending = true;
  pushTimer = window.setTimeout(() => {
    if (!storage.getToken()) return void (pending = false);
    api
      .put("/customer/watchlist", { items: storage.getWatchlist() })
      .catch(() => {})
      .finally(() => (pending = false));
  }, 400);
}

const MERGED_KEY = "gp_wl_merged"; // the account this device's guest list was merged into
const mergedFor = () => {
  try {
    return localStorage.getItem(MERGED_KEY);
  } catch {
    return null;
  }
};
const setMergedFor = (t: string | null) => {
  try {
    if (t) localStorage.setItem(MERGED_KEY, t);
    else localStorage.removeItem(MERGED_KEY);
  } catch {
    /* ignore */
  }
};

/** Signed in: the account's list wins (so a removal on another device sticks).
 *  Only right after a login is this device's guest list merged into the account, once. */
async function pull() {
  const token = storage.getToken();
  if (!token) {
    syncedToken = null;
    return;
  }
  if (syncedToken === token) return;
  syncedToken = token;
  try {
    const r = await api.get<{ data?: WatchlistEntry[] }>("/customer/watchlist");
    const server = Array.isArray(r.data?.data) ? r.data!.data! : [];
    if (mergedFor() === token) {
      if (pending) return; // a newer local change will overwrite the account anyway
      storage.setWatchlist(server);
      notify();
      return;
    }
    const seen = new Set<string>();
    const merged: WatchlistEntry[] = [];
    for (const x of [...storage.getWatchlist(), ...server]) if (x && x.id && !seen.has(x.id)) (seen.add(x.id), merged.push(x));
    storage.setWatchlist(merged);
    setMergedFor(token);
    notify();
    if (merged.length !== server.length) push();
  } catch {
    syncedToken = null; // try again later
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("gp-auth-changed", () => {
    if (!storage.getToken()) {
      // signed out (also an expired login): the list stays with the account, not on this device
      setMergedFor(null);
      syncedToken = null;
      if (storage.getWatchlist().length) {
        storage.setWatchlist([]);
        notify();
      }
      return;
    }
    void pull();
  });
  window.setTimeout(() => void pull(), 0);
}

export function useWatchlist() {
  const [list, setList] = useState<WatchlistEntry[]>(storage.getWatchlist());

  useEffect(() => {
    const sync = () => setList(storage.getWatchlist());
    window.addEventListener(EVENT, sync);
    void pull();
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const save = (next: WatchlistEntry[]) => {
    storage.setWatchlist(next);
    setList(next);
    notify();
    push();
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

  /** put an entry back where it was (Undo) */
  const restore = useCallback((entry: WatchlistEntry, index = 0) => {
    const cur = storage.getWatchlist().filter((x) => x.id !== entry.id);
    cur.splice(Math.min(index, cur.length), 0, entry);
    save(cur);
  }, []);

  const remove = useCallback((id: string) => save(storage.getWatchlist().filter((x) => x.id !== id)), []);

  return { list, has, toggle, remove, restore };
}
