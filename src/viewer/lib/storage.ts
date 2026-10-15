// Things kept on this device (like the app's SharedPreferences). Every access is wrapped:
// private browsing or blocked storage must never break the page.
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

export interface WatchlistEntry {
  id: string;
  kind: "movie" | "webseries" | "tvshow";
  title: string;
  poster: string;
}

/** Continue Watching kept on this device: series episodes (server only tracks movies) + movies for guests */
export interface LocalCw {
  id: string; // movie or series id
  kind: "movie" | "webseries" | "tvshow";
  epId?: string;
  epLabel?: string; // "S1 E3"
  t: number;
  d: number;
  title: string;
  banner: string;
  free: boolean;
  at: number;
}

export const storage = {
  getToken: () => read<string | null>("gp_token", null),
  getMobile: () => read<string | null>("gp_mobile", null),
  setAuth: (token: string, mobile: string) => {
    write("gp_token", token);
    write("gp_mobile", mobile);
  },
  clearAuth: () => {
    write("gp_token", null);
    write("gp_mobile", null);
  },

  getProfile: () => read<{ name?: string; email?: string; age?: string }>("gp_profile", {}),
  setProfile: (p: { name?: string; email?: string; age?: string }) => write("gp_profile", p),

  getWatchlist: () => read<WatchlistEntry[]>("gp_watchlist", []),
  setWatchlist: (list: WatchlistEntry[]) => write("gp_watchlist", list),

  getLikes: () => read<string[]>("gp_likes", []),
  setLikes: (ids: string[]) => write("gp_likes", ids),

  getRecentSearches: () => read<string[]>("gp_recent_searches", []),
  setRecentSearches: (list: string[]) => write("gp_recent_searches", list.slice(0, 10)),

  getMuted: () => read<boolean>("gp_video_muted", true),
  setMuted: (m: boolean) => write("gp_video_muted", m),

  getOnboarded: () => read<boolean>("gp_onboarded", false),
  setOnboarded: () => write("gp_onboarded", true),

  // last position for titles the server doesn't track (episodes), keyed by id
  getLocalCw: () => read<LocalCw[]>("gp_cw_local", []),
  saveLocalCw: (e: LocalCw) => write("gp_cw_local", [e, ...read<LocalCw[]>("gp_cw_local", []).filter((x) => x.id !== e.id)].slice(0, 20)),
  removeLocalCw: (id: string) => write("gp_cw_local", read<LocalCw[]>("gp_cw_local", []).filter((x) => x.id !== id)),

  getProgress: (id: string) => read<number>(`gp_pos_${id}`, 0),
  setProgress: (id: string, seconds: number) => write(`gp_pos_${id}`, Math.floor(seconds)),
};
