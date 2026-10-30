// One shape for movies, web series and TV shows, so every screen can treat them the same.
import type { ApiEpisode, ApiMovie, ApiSeries, ApiSeason } from "./api";
import { storage } from "./storage";

export type Kind = "movie" | "webseries" | "tvshow";

export interface Person {
  name: string;
  role: string;
  image: string;
}

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  poster: string; // portrait
  banner: string; // landscape
  bigVertical: string;
  logo: string; // title logo image (movies)
  genres: string[];
  lang: string;
  imdb: number;
  age: string;
  year?: number;
  durationMin?: number;
  description: string;
  isFree: boolean;
  playUrl: string | null;
  /** why there's no playUrl: no file yet / Bunny still processing / Bunny failed */
  noVideo?: NoVideo;
  trailerUrl: string | null;
  skipIntro?: { start: number; end: number };
  people: Person[];
  seasons: ApiSeason[];
  views: number;
  createdAt?: string;
}

const clean = (s?: string | null) => (s && String(s).trim()) || "";

// Bunny video status: 4 = ready, 5/6 = failed, 0–3 = still processing (created / uploaded / processing / transcoding).
// The status only means something for videos uploaded to Bunny (they have a videoId) — the server's
// status sync keeps those up to date. Old records without a videoId keep the default status 2 forever
// although they play fine → treat them as ready. (No time window: the series/movie updatedAt changes
// for unrelated edits, and the API has no video-level upload time.)
const videoReady = (status?: number, videoId?: string) => {
  if (status === undefined || status === null || status === 4) return true;
  if (status === 5 || status === 6) return false;
  return !videoId;
};

export type NoVideo = "none" | "processing" | "failed";
/** reason a video can't be played yet (only meaningful when there is no play link) */
export const noVideoReason = (f?: { status?: number; videoId?: string } | null): NoVideo =>
  !f?.videoId ? "none" : f.status === 5 || f.status === 6 ? "failed" : f.status === 4 ? "none" : "processing";

export const fromMovie = (m: ApiMovie): Item => ({
  id: m._id,
  kind: "movie",
  title: m.movieTitle || "",
  poster: clean(m.verticalPosterUrl) || clean(m.horizontalBannerUrl),
  banner: clean(m.horizontalBannerUrl) || clean(m.verticalPosterUrl),
  bigVertical: clean(m.bigVerticalUrl) || clean(m.verticalPosterUrl),
  logo: clean(m.logoUrl),
  genres: Array.isArray(m.genres) ? m.genres : [],
  lang: m.lang || "",
  imdb: Number(m.imdbRating) || 0,
  age: m.ageRating || "",
  year: m.releaseYear,
  durationMin: m.duration,
  description: m.description || m.fullStoryline || "",
  isFree: !m.subscriptionRequired,
  playUrl:
    clean(m.customVideoUrl) ||
    (videoReady(m.movieFile?.status, m.movieFile?.videoId) ? clean(m.videoStreamUrl) || clean(m.movieFile?.hlsUrl) : "") ||
    null,
  noVideo: noVideoReason(m.movieFile),
  trailerUrl: clean(m.trailerStreamUrl) || null,
  skipIntro: m.skipIntro && (m.skipIntro.end || 0) > (m.skipIntro.start || 0)
    ? { start: m.skipIntro.start || 0, end: m.skipIntro.end || 0 }
    : undefined,
  people: [
    ...(Array.isArray(m.crew) ? m.crew : []).map((p) => ({ name: p.name, role: p.role || "", image: p.imageUrl || "" })),
    ...(Array.isArray(m.cast) ? m.cast : []).map((p) => ({ name: p.name, role: p.character || "Cast", image: p.imageUrl || "" })),
  ].filter((p) => p.name),
  seasons: [],
  views: m.viewCount || 0,
  createdAt: m.createdAt,
});

export const fromSeries = (s: ApiSeries): Item => {
  const seasons = (Array.isArray(s.seasons) ? s.seasons : [])
    .map((se) => ({
      ...se,
      // decide once whether each episode can play
      episodes: (Array.isArray(se.episodes) ? se.episodes : []).filter((e) => e.isPublished !== false).map((e) => ({ ...e, webPlay: episodeUrl(e) })),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const firstEp = seasons[0]?.episodes?.[0];
  return {
    id: s._id,
    kind: (s.type || s.contentType) === "tvshow" ? "tvshow" : "webseries",
    title: s.title || "",
    poster: clean(s.verticalPoster) || clean(s.thumbnail) || clean(s.horizontalBanner),
    banner: clean(s.horizontalBanner) || clean(s.thumbnail) || clean(s.verticalPoster),
    bigVertical: clean(s.verticalPoster),
    logo: "",
    genres: Array.isArray(s.genres) ? s.genres : [],
    lang: s.lang || "",
    imdb: Number(s.imdbRating) || 0,
    age: s.ageRating || "",
    description: s.description || "",
    isFree: !s.subscriptionRequired,
    playUrl: firstEp ? episodeUrl(firstEp) : null,
    trailerUrl: clean(s.trailerStreamUrl) || null,
    people: (Array.isArray(s.castAndCrew) ? s.castAndCrew : [])
      .filter((p) => p && p.personName)
      .map((p) => ({ name: p.personName!, role: p.characterName || p.role || "", image: p.profileImage?.url || "" })),
    seasons,
    views: s.viewCount || 0,
  };
};

export const episodeUrl = (
  e: { videoStreamUrl?: string | null; customVideoUrl?: string; videoFile?: { url?: string; hlsUrl?: string; status?: number; videoId?: string }; webPlay?: string | null }
): string | null =>
  e.webPlay !== undefined
    ? e.webPlay
    : clean(e.customVideoUrl) ||
  (videoReady(e.videoFile?.status, e.videoFile?.videoId)
    ? clean(e.videoStreamUrl) || clean(e.videoFile?.url) || clean(e.videoFile?.hlsUrl)
    : "") ||
  null;

/** Link to the detail page for an item */
export const detailPath = (it: Pick<Item, "id" | "kind">) => (it.kind === "movie" ? `/movie/${it.id}` : `/series/${it.id}`);

/** "Hindi • Drama • Action" style info line */
export const infoLine = (it: Item, max = 2) => [it.lang, ...it.genres.slice(0, max)].filter(Boolean).join(" • ");

export const kindLabel = (k: Kind) => (k === "movie" ? "Movie" : k === "tvshow" ? "TV Show" : "Web Series");

/** Category "type" from the backend → our Kind */
export const categoryKind = (type?: string, name?: string): Kind | null => {
  const t = String(type || name || "").toLowerCase().replace(/[\s_-]/g, "");
  if (t.startsWith("movie") || t === "shorts") return "movie";
  if (t.startsWith("tvshow")) return "tvshow";
  if (t.startsWith("webseries") || t === "series") return "webseries";
  return null;
};

export const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/** What the big Play button of a series does: resume the episode this device was watching
 *  ("Resume S2 E4"), otherwise start the first episode that can play, across all seasons. */
export function seriesPlayTarget(it: Item): { ep: ApiEpisode | undefined; label: string; shortLabel: string; resume: boolean } {
  const flat = it.seasons.flatMap((s) =>
    [...(s.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber).map((ep) => ({ ep, season: s.seasonNumber }))
  );
  const cw = storage.getLocalCw().find((x) => x.id === it.id && x.epId);
  const resumed = cw ? flat.find((f) => f.ep._id === cw.epId && !!episodeUrl(f.ep)) : undefined;
  if (resumed) {
    const label = `Resume S${resumed.season} E${resumed.ep.episodeNumber}`;
    return { ep: resumed.ep, label, shortLabel: label, resume: true };
  }
  const first = flat.find((f) => !!episodeUrl(f.ep)) || flat[0];
  if (!first) return { ep: undefined, label: "Play", shortLabel: "Play", resume: false };
  const isFirst = first === flat[0] && first.ep.episodeNumber === 1;
  return {
    ep: first.ep,
    label: isFirst ? "Play Episode 1" : `Play S${first.season} E${first.ep.episodeNumber}`,
    shortLabel: "Play",
    resume: false,
  };
}
