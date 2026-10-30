// Player screen: /watch/movie/:id  or  /watch/series/:id?ep=<episodeId>  (optional &t=<seconds>)
// Plays FREE titles only. Below the 16:9 player: title, "Up next" episodes, Similar/Trending and EXPLORE MORE rows.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Play } from "lucide-react";
import { api, ApiEpisode } from "@v/lib/api";
import { episodeUrl, infoLine, Item, NoVideo, noVideoReason } from "@v/lib/content";
import { storage } from "@v/lib/storage";
import { useAuth } from "@v/lib/auth";
import { useCatalog } from "@v/hooks/useCatalog";
import { AppShell } from "@v/components/AppShell";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { Img } from "@v/components/Img";
import { VideoPlayer } from "@v/components/player/VideoPlayer";
import { ExploreRow } from "@v/components/player/ExploreRow";
import { episodeThumb } from "@v/components/detail/EpisodeList";
import { useMovieQuery, useSeriesQuery } from "@v/components/detail/queries";
import { DetailError, isNotFound } from "@v/components/detail/DetailParts";
import { useGoBack } from "@v/hooks/useGoBack";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { DesktopEpisodes } from "@v/components/desktop/DesktopDetail";
import { MetaLine } from "@v/components/desktop/DesktopHero";
import { DesktopRow, PosterTile, Scroller } from "@v/components/desktop/Rows";
import { ActionPills, useItemActions } from "@v/components/detail/ActionPills";
import { CircleCheck, Plus, Share2, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";

interface FlatEpisode {
  ep: ApiEpisode;
  season: number;
}

const toSkip = (s?: { start?: number; end?: number }) =>
  s && (s.end || 0) > (s.start || 0) ? { start: s.start || 0, end: s.end || 0 } : undefined;

// Last position per movie / episode during this visit. Used when the player is rebuilt
// (e.g. the window crosses the phone/desktop size) so it doesn't jump back to an older point.
const sessionPos = new Map<string, number>();

interface MediaCtx {
  item: Item;
  episodes: FlatEpisode[];
}

export default function Watch() {
  const { kind = "", id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { isLoggedIn, token } = useAuth();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const desktop = useIsDesktop();

  const isMovie = kind === "movie";
  const isSeries = kind === "series";
  const movieQ = useMovieQuery(id, isMovie);
  const seriesQ = useSeriesQuery(id, isSeries);
  const q = isMovie ? movieQ : seriesQ;
  const item: Item | undefined = q.data;

  const epParam = params.get("ep");
  const tParam = Math.max(0, Number(params.get("t")) || 0);

  const [appOnly, setAppOnly] = useState(true);

  // every episode in order
  const episodes: FlatEpisode[] = useMemo(() => {
    if (!item || item.kind === "movie") return [];
    return item.seasons.flatMap((s) =>
      [...(s.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber).map((ep) => ({ ep, season: s.seasonNumber }))
    );
  }, [item]);

  // which movie / episode a save belongs to (kept for titles seen on this page, so a late save still lands right)
  const mediaReg = useRef(new Map<string, MediaCtx>());
  useMemo(() => {
    if (!item) return;
    if (item.kind === "movie") mediaReg.current.set(item.id, { item, episodes: [] });
    else for (const e of episodes) mediaReg.current.set(e.ep._id, { item, episodes });
  }, [item, episodes]);

  const currentIdx = useMemo(() => {
    if (!episodes.length) return -1;
    const byParam = epParam ? episodes.findIndex((e) => e.ep._id === epParam) : -1;
    if (byParam >= 0) return byParam;
    // no episode asked for → the one this device was watching, else the first that can play
    const cwEp = storage.getLocalCw().find((x) => x.id === id)?.epId;
    const byCw = cwEp ? episodes.findIndex((e) => e.ep._id === cwEp && !!episodeUrl(e.ep)) : -1;
    if (byCw >= 0) return byCw;
    const firstPlayable = episodes.findIndex((e) => !!episodeUrl(e.ep));
    return firstPlayable >= 0 ? firstPlayable : 0;
  }, [episodes, epParam, id]);

  const current = currentIdx >= 0 ? episodes[currentIdx] : null;
  // ?t= belongs to the episode named by ?ep= — if that episode isn't there, don't apply it to another one
  const epMatched = !!epParam && !!current && current.ep._id === epParam;
  const tStart = isMovie || epMatched ? tParam : 0;
  const upNext = useMemo(() => (currentIdx >= 0 ? episodes.slice(currentIdx + 1) : []), [episodes, currentIdx]);
  const nextPlayable = upNext.find((e) => !!episodeUrl(e.ep)) || null;

  const src = item ? (isMovie ? item.playUrl : current ? episodeUrl(current.ep) : null) : null;
  const noVid: NoVideo = !item ? "none" : isMovie ? item.noVideo || "none" : noVideoReason(current?.ep.videoFile);
  const epId = current?.ep._id;
  const mediaId = isMovie ? item?.id : epId;

  // movies: server-side resume point for this account (doesn't block playback; the player seeks if it arrives early)
  const cw = useQuery({
    queryKey: ["continue-watching", "resume", token],
    queryFn: async () =>
      (await api.get<{ data: { _id: string; movie?: { _id: string } | null; watchedTime?: number; duration?: number }[] }>("/continue-watching")).data
        ?.data || [],
    enabled: isMovie && isLoggedIn && tParam <= 0 && !!id,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const serverResume = useMemo(() => {
    const row = (cw.data || []).find((r) => r.movie?._id === id);
    const w = Number(row?.watchedTime) || 0;
    const d = Number(row?.duration) || 0;
    return w > 10 && (!d || w < d - 30) ? w : 0;
  }, [cw.data, id]);

  // resume point, read fresh on every render (cheap) so a rebuilt player never starts from a stale value:
  // this visit's last position → ?t=… → server (signed-in movies) / this device (guests, episodes)
  const sessionStart = mediaId ? sessionPos.get(mediaId) : undefined;
  const deviceStart = !mediaId
    ? 0
    : isMovie
      ? isLoggedIn
        ? serverResume
        : storage.getLocalCw().find((x) => x.id === mediaId && x.kind === "movie")?.t || 0
      : storage.getProgress(mediaId);
  const startAt = sessionStart !== undefined ? sessionStart : tStart > 0 ? tStart : deviceStart;
  // only the server's answer may arrive late and move the player (never this visit's own saves)
  const lateStartAt = sessionStart === undefined && tStart <= 0 && isMovie && isLoggedIn ? serverResume : 0;

  // keep Home's Continue Watching row fresh (mark stale; it refetches when shown).
  // After a save: also refetch any row on screen (the save on closing lands after Home is back),
  // but not this page's own resume lookup.
  const markCwStale = useCallback(
    (refetch = false) =>
      queryClient.invalidateQueries({
        queryKey: ["continue-watching"],
        refetchType: refetch ? "active" : "none",
        predicate: (q) => q.queryKey[1] !== "resume",
      }),
    [queryClient]
  );
  useEffect(() => () => void markCwStale(false), [markCwStale]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id, epId]);

  const playEpisode = useCallback(
    (e: FlatEpisode) => navigate(`/watch/series/${id}?ep=${e.ep._id}`, { replace: true }),
    [navigate, id]
  );

  // saves always say WHICH movie / episode they are for (the player may already show the next one)
  const authRef = useRef({ isLoggedIn, markCwStale });
  authRef.current = { isLoggedIn, markCwStale };
  const onSave = useCallback((t: number, d: number, completed: boolean, media: string | undefined, urgent: boolean) => {
    const ctx = media ? mediaReg.current.get(media) : undefined;
    if (!media || !ctx) return;
    const { item: it, episodes: eps } = ctx;
    sessionPos.set(media, completed ? 0 : t);
    const isEp = it.kind !== "movie";
    const idx = isEp ? eps.findIndex((e) => e.ep._id === media) : -1;
    const cur = idx >= 0 ? eps[idx] : null;
    const nextUp = idx >= 0 ? eps.slice(idx + 1).find((e) => !!episodeUrl(e.ep)) || null : null;
    const local = (extra: { epId?: string; epLabel?: string }) => {
      if (completed && !nextUp) storage.removeLocalCw(it.id);
      else if (t > 10 || (completed && nextUp))
        storage.saveLocalCw({ id: it.id, kind: it.kind, t: Math.floor(completed ? 0 : t), d: Math.floor(d), title: it.title, banner: it.banner, free: it.isFree, at: Date.now(), ...extra });
    };
    if (!isEp) {
      if (!authRef.current.isLoggedIn) {
        local({}); // guests: remember on this device
        return;
      }
      const body = { movieId: it.id, watchedTime: Math.floor(t), duration: Math.floor(d), isCompleted: completed };
      if (urgent) {
        // the tab is going away: a keepalive request finishes even after the page is gone
        try {
          const tok = storage.getToken();
          void fetch(`${api.defaults.baseURL || "/api"}/continue-watching/save`, {
            method: "POST",
            keepalive: true,
            headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}`, "X-GG-Token": tok } : {}) },
            body: JSON.stringify(body),
          }).catch(() => {});
        } catch {
          /* ignore */
        }
        return;
      }
      api
        .post("/continue-watching/save", body)
        .then(() => authRef.current.markCwStale(true))
        .catch(() => {});
    } else if (cur) {
      storage.setProgress(media, completed ? 0 : t);
      // finished an episode → Continue Watching points at the next one
      if (completed && nextUp) local({ epId: nextUp.ep._id, epLabel: `S${nextUp.season} E${nextUp.ep.episodeNumber}` });
      else local({ epId: media, epLabel: `S${cur.season} E${cur.ep.episodeNumber}` });
    }
  }, []);

  // rows under the player
  const others = useMemo(() => (item ? catalog.everything.filter((x) => x.id !== item.id) : []), [catalog.everything, item]);
  const { firstTitle, firstRow, exploreRow } = useMemo(() => {
    const genres = new Set((item?.genres || []).map((g) => g.toLowerCase()));
    const similar = others.filter((x) => x.genres.some((g) => genres.has(g.toLowerCase()))).slice(0, 20);
    const first = similar.length ? similar : [...others].sort((a, b) => b.views - a.views).slice(0, 15);
    const used = new Set(first.map((x) => x.id));
    return {
      firstTitle: similar.length ? "Similar Videos" : "Trending Videos",
      firstRow: first,
      exploreRow: others.filter((x) => !used.has(x.id)),
    };
  }, [others, item]);

  /* ── states ── */
  if (!isMovie && !isSeries) return <DetailError notFound onRetry={() => navigate("/")} />;
  if (q.isLoading) {
    return (
      <AppShell nav={false} wide>
        <div className={desktop ? "px-[4%] pt-6" : undefined}>
          <div
            className={desktop ? "mx-auto flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black" : "flex aspect-video w-full items-center justify-center bg-black"}
            style={desktop ? { maxWidth: PLAYER_MAX } : undefined}
          >
            <Loader2 className="h-10 w-10 animate-spin text-[#E50914]" />
          </div>
        </div>
        {!desktop && (
          <>
            <div className="space-y-2 px-4 pt-4">
              <div className="shimmer h-5 w-2/3 rounded" />
              <div className="shimmer h-3 w-1/3 rounded" />
            </div>
            <ExploreRow title="EXPLORE MORE" items={[]} loading compact />
          </>
        )}
      </AppShell>
    );
  }
  if (q.error || !item) return <DetailError notFound={isNotFound(q.error)} onRetry={() => q.refetch()} />;

  // paid titles never play on the web
  if (!item.isFree) {
    return (
      <AppShell nav={false}>
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          <Img src={item.banner} alt={item.title} className="absolute inset-0 h-full w-full opacity-50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Crown className="h-8 w-8 text-imdb" />
            <p className="text-sm font-semibold">This title plays only in the Gutargoo+ app.</p>
            <div className="flex gap-3">
              <button type="button" onClick={goBack} className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold">
                Back
              </button>
              <button type="button" onClick={() => setAppOnly(true)} className="rounded-lg bg-gradient-to-b from-[#9E1119] via-[#DF4119] to-[#9E1119] px-4 py-2 text-sm font-semibold">
                Get the app
              </button>
            </div>
          </div>
        </div>
        <h1 className="break-words px-4 pt-4 text-lg font-bold leading-tight">{item.title}</h1>
        <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
      </AppShell>
    );
  }

  const subtitle = current ? `S${current.season} E${current.ep.episodeNumber} · ${current.ep.title}` : undefined;
  const skipIntro = isMovie ? item.skipIntro : toSkip(current?.ep.skipIntro);
  const meta = [infoLine(item, 3), item.year ? String(item.year) : "", item.age].filter(Boolean).join(" • ");

  // ONE player per title: the next episode only changes `src`, so fullscreen stays on.
  // It sits at the same place in the tree for phone and desktop layouts.
  const playerBox = src ? (
    <VideoPlayer
      key={item.id}
      src={src}
      mediaId={mediaId}
      title={item.title}
      subtitle={subtitle}
      startAt={startAt}
      lateStartAt={lateStartAt}
      skipIntro={skipIntro}
      next={nextPlayable ? { title: nextPlayable.ep.title, onPlay: () => playEpisode(nextPlayable) } : null}
      onBack={goBack}
      onSave={onSave}
    />
  ) : (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center">
      <Img src={item.banner} alt="" className="absolute inset-0 h-full w-full opacity-30" />
      <p className={desktop ? "relative text-2xl font-bold text-orange" : "relative text-base font-bold text-orange"}>Coming Soon</p>
      <p className={desktop ? "relative text-white/70" : "relative text-xs text-white/70"}>
        <span className="font-semibold text-[#FF8A7D]">Reason: </span>
        {noVid === "processing" ? "the video is still being processed on Bunny. It will play in a few minutes." : noVid === "failed" ? "Bunny couldn't process this video file. It needs to be uploaded again from Admin." : `no video file has been added for this ${isMovie ? "movie" : "episode"} yet.`}
      </p>
      <button type="button" onClick={goBack} className="relative rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold">
        Back
      </button>
    </div>
  );

  return (
    <AppShell nav={false} wide>
      {/* phone: "contents" (no box) so the sticky player is limited by the whole page, not by this wrapper */}
      <div className={desktop ? "px-[4%] pt-6" : "contents"}>
        {/* desktop: player sized to fit the screen height · phone: sticks to the top while scrolling */}
        <div
          className={desktop ? "mx-auto overflow-hidden rounded-xl bg-black shadow-[0_20px_60px_rgba(0,0,0,.8)]" : "sticky-top-portrait relative z-30 bg-black"}
          style={desktop ? { maxWidth: PLAYER_MAX } : undefined}
        >
          {playerBox}
        </div>
        {desktop ? (
          <WatchInfo key={item.id} item={item} episodeLine={current ? `Season ${current.season} · Episode ${current.ep.episodeNumber}: ${current.ep.title}` : undefined} />
        ) : (
          <>
            <div className="px-4 pt-4">
              <h1 className="break-words text-lg font-bold leading-tight">{item.title}</h1>
              {current && (
                <p className="mt-1 break-words text-[13px] text-white/75">
                  Season {current.season} · Episode {current.ep.episodeNumber}: {current.ep.title}
                </p>
              )}
              {meta && <p className="mt-1 text-xs text-[#9E9E9E]">{meta}</p>}
            </div>
            <ActionPills key={item.id} item={item} />
          </>
        )}
      </div>

      {desktop ? (
        <>
          {episodes.length > 0 && (
            <section className="mt-10 px-[4%]">
              <h2 className="mb-4 text-[1.3rem] font-bold">Episodes</h2>
              <DesktopEpisodes
                seasons={item.seasons}
                fallbackThumb={item.banner}
                currentId={epId}
                onPlay={(ep) => {
                  const f = episodes.find((e) => e.ep._id === ep._id);
                  if (f && episodeUrl(f.ep)) playEpisode(f);
                }}
              />
            </section>
          )}

          <div className="mt-10">
            {firstRow.length > 0 && (
              <DesktopRow title={firstTitle}>
                <Scroller>
                  {firstRow.map((it) => (
                    <PosterTile key={it.id} item={it} />
                  ))}
                </Scroller>
              </DesktopRow>
            )}
            {exploreRow.length > 0 && (
              <DesktopRow title="Explore More">
                <Scroller>
                  {exploreRow.map((it) => (
                    <PosterTile key={it.id} item={it} />
                  ))}
                </Scroller>
              </DesktopRow>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Up next (series) */}
          {upNext.length > 0 && (
            <section className="pt-7">
              <h2 className="px-4 pb-2 text-base font-bold">Up next</h2>
              <div>
                {upNext.map((e) => {
                  const available = !!episodeUrl(e.ep);
                  const inner = (
                    <>
                      <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md">
                        <Img src={episodeThumb(e.ep, item.banner)} alt={e.ep.title} className="h-full w-full" />
                        {available ? (
                          <span className="absolute bottom-1.5 left-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55">
                            <Play className="h-3 w-3" fill="currentColor" />
                          </span>
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold text-orange">Coming Soon</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-[13px] font-semibold leading-snug">{e.ep.title}</p>
                        <p className="mt-1 text-[11px] text-white/55">
                          S{e.season} · Episode {e.ep.episodeNumber}
                        </p>
                      </div>
                    </>
                  );
                  const cls = "flex w-full gap-3 border-b border-white/10 px-4 py-2.5 text-left";
                  return available ? (
                    <button key={e.ep._id} type="button" onClick={() => playEpisode(e)} className={`${cls} hover:bg-white/[.03]`}>
                      {inner}
                    </button>
                  ) : (
                    <div key={e.ep._id} className={`${cls} opacity-80`} aria-disabled="true">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <ExploreRow title={firstTitle} items={firstRow} loading={catalog.loading} />
          <div className="pb-6">
            <ExploreRow title="EXPLORE MORE" items={exploreRow} loading={catalog.loading} compact />
          </div>
        </>
      )}
    </AppShell>
  );
}

const PLAYER_MAX = "min(100%, calc((100vh - 9rem) * 16 / 9))";

function WatchAction({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-orange bg-orange/15 text-orange" : "border-white/25 hover:bg-white/10"}`}
    >
      {children}
      {label}
    </button>
  );
}

/** Title, info and actions under the big-screen player */
function WatchInfo({ item, episodeLine }: { item: Item; episodeLine?: string }) {
  const { liked, toggleLike, inList, toggleList, share } = useItemActions(item);
  return (
    <div className="mx-auto mt-6 flex flex-wrap items-start justify-between gap-6" style={{ maxWidth: PLAYER_MAX }}>
      <div className="min-w-0 max-w-[48rem] flex-1">
        <h1 className="break-words text-[2rem] font-black leading-tight">{item.title}</h1>
        {episodeLine && <p className="mt-1 text-lg text-white/75">{episodeLine}</p>}
        <MetaLine item={item} className="mt-3" />
        {item.description && <p className="mt-4 line-clamp-3 leading-relaxed text-white/70">{item.description}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <WatchAction label="My List" active={inList} onClick={toggleList}>
          {inList ? <CircleCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </WatchAction>
        <WatchAction label="Like" active={liked} onClick={toggleLike}>
          <ThumbsUp className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
        </WatchAction>
        <WatchAction label="Share" onClick={share}>
          <Share2 className="h-4 w-4" />
        </WatchAction>
      </div>
    </div>
  );
}
