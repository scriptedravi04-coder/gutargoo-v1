// Player screen: /watch/movie/:id  or  /watch/series/:id?ep=<episodeId>  (optional &t=<seconds>)
// Plays FREE titles only. Below the 16:9 player: title, "Up next" episodes, Similar/Trending and EXPLORE MORE rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2, Play } from "lucide-react";
import { api, ApiEpisode } from "@v/lib/api";
import { episodeUrl, infoLine, Item } from "@v/lib/content";
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
import { useItemActions } from "@v/components/detail/ActionPills";
import { CircleCheck, Plus, Share2, ThumbsUp } from "lucide-react";
import type { ReactNode } from "react";

interface FlatEpisode {
  ep: ApiEpisode;
  season: number;
}

const toSkip = (s?: { start?: number; end?: number }) =>
  s && (s.end || 0) > (s.start || 0) ? { start: s.start || 0, end: s.end || 0 } : undefined;

export default function Watch() {
  const { kind = "", id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { isLoggedIn } = useAuth();
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

  const currentIdx = useMemo(() => {
    if (!episodes.length) return -1;
    const byParam = epParam ? episodes.findIndex((e) => e.ep._id === epParam) : -1;
    if (byParam >= 0) return byParam;
    const firstPlayable = episodes.findIndex((e) => !!episodeUrl(e.ep));
    return firstPlayable >= 0 ? firstPlayable : 0;
  }, [episodes, epParam]);

  const current = currentIdx >= 0 ? episodes[currentIdx] : null;
  const upNext = useMemo(() => (currentIdx >= 0 ? episodes.slice(currentIdx + 1) : []), [episodes, currentIdx]);
  const nextPlayable = upNext.find((e) => !!episodeUrl(e.ep)) || null;

  const src = item ? (isMovie ? item.playUrl : current ? episodeUrl(current.ep) : null) : null;
  const epId = current?.ep._id;

  // movies: server-side resume point (doesn't block playback; the player seeks if it arrives early)
  const cw = useQuery({
    queryKey: ["continue-watching"],
    queryFn: async () =>
      (await api.get<{ data: { _id: string; movie?: { _id: string } | null; watchedTime?: number; duration?: number }[] }>("/continue-watching")).data
        ?.data || [],
    enabled: isMovie && isLoggedIn && tParam <= 0 && !!id,
    staleTime: 0,
    retry: false,
  });
  const serverResume = useMemo(() => {
    const row = (cw.data || []).find((r) => r.movie?._id === id);
    const w = Number(row?.watchedTime) || 0;
    const d = Number(row?.duration) || 0;
    return w > 10 && (!d || w < d - 30) ? w : 0;
  }, [cw.data, id]);

  // resume point: ?t=…, otherwise the server's (movies) or this device's (episodes) last position
  const startAt = useMemo(
    () => (tParam > 0 ? tParam : epId ? storage.getProgress(epId) : isMovie ? serverResume : 0),
    [tParam, epId, isMovie, serverResume]
  );

  // keep Home's Continue Watching row fresh (mark stale; it refetches when shown)
  const markCwStale = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["continue-watching"], refetchType: "none" }),
    [queryClient]
  );
  useEffect(() => () => void markCwStale(), [markCwStale]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id, epId]);

  const playEpisode = useCallback(
    (e: FlatEpisode) => navigate(`/watch/series/${id}?ep=${e.ep._id}`, { replace: true }),
    [navigate, id]
  );

  const onSave = useCallback(
    (t: number, d: number, completed: boolean) => {
      if (!item) return;
      const local = (extra: { epId?: string; epLabel?: string }) => {
        if (completed && !nextPlayable) storage.removeLocalCw(item.id);
        else if (t > 10)
          storage.saveLocalCw({ id: item.id, kind: item.kind, t: Math.floor(completed ? 0 : t), d: Math.floor(d), title: item.title, banner: item.banner, free: item.isFree, at: Date.now(), ...extra });
      };
      if (isMovie) {
        if (!isLoggedIn) {
          local({}); // guests: remember on this device
          return;
        }
        api
          .post("/continue-watching/save", {
            movieId: item.id,
            watchedTime: Math.floor(t),
            duration: Math.floor(d),
            isCompleted: completed,
          })
          .then(() => markCwStale())
          .catch(() => {});
      } else if (epId) {
        storage.setProgress(epId, completed ? 0 : t);
        // finished an episode → Continue Watching points at the next one
        if (completed && nextPlayable) local({ epId: nextPlayable.ep._id, epLabel: `S${nextPlayable.season} E${nextPlayable.ep.episodeNumber}` });
        else local({ epId, epLabel: current ? `S${current.season} E${current.ep.episodeNumber}` : undefined });
      }
    },
    [item, isMovie, isLoggedIn, epId, markCwStale, nextPlayable, current]
  );

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
      <AppShell nav={false}>
        <div className="flex aspect-video w-full items-center justify-center bg-black">
          <Loader2 className="h-10 w-10 animate-spin text-[#E50914]" />
        </div>
        <div className="space-y-2 px-4 pt-4">
          <div className="shimmer h-5 w-2/3 rounded" />
          <div className="shimmer h-3 w-1/3 rounded" />
        </div>
        <ExploreRow title="EXPLORE MORE" items={[]} loading compact />
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
        <h1 className="px-4 pt-4 text-base font-bold">{item.title}</h1>
        <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
      </AppShell>
    );
  }

  const subtitle = current ? `S${current.season} E${current.ep.episodeNumber} · ${current.ep.title}` : undefined;
  const skipIntro = isMovie ? item.skipIntro : toSkip(current?.ep.skipIntro);
  const meta = [infoLine(item, 3), item.year ? String(item.year) : "", item.age].filter(Boolean).join(" • ");

  const playerBox = src ? (
    <VideoPlayer
      key={src}
      src={src}
      title={item.title}
      subtitle={subtitle}
      startAt={startAt}
      skipIntro={skipIntro}
      next={nextPlayable ? { title: nextPlayable.ep.title, onPlay: () => playEpisode(nextPlayable) } : null}
      onBack={goBack}
      onSave={onSave}
    />
  ) : null;

  if (desktop) {
    return (
      <AppShell wide>
        <div className="px-[4%] pt-6">
          {/* player sized to fit the screen height */}
          <div className="mx-auto overflow-hidden rounded-xl bg-black shadow-[0_20px_60px_rgba(0,0,0,.8)]" style={{ maxWidth: "min(100%, calc((100vh - 9rem) * 16 / 9))" }}>
            {playerBox || (
              <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Img src={item.banner} alt="" className="absolute inset-0 h-full w-full opacity-30" />
                <p className="relative text-2xl font-bold text-orange">Coming Soon</p>
                <p className="relative text-white/70">This {isMovie ? "movie" : "episode"} isn't available to watch yet.</p>
                <button type="button" onClick={goBack} className="relative rounded-lg border border-white/25 px-5 py-2.5 font-semibold">
                  Back
                </button>
              </div>
            )}
          </div>
          <WatchInfo key={item.id} item={item} episodeLine={current ? `Season ${current.season} · Episode ${current.ep.episodeNumber}: ${current.ep.title}` : undefined} />
        </div>

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
      </AppShell>
    );
  }

  return (
    <AppShell nav={false}>
      <div className="sticky top-0 z-30 bg-black">
        {src ? (
          <VideoPlayer
            key={src}
            src={src}
            title={item.title}
            subtitle={subtitle}
            startAt={startAt}
            skipIntro={skipIntro}
            next={nextPlayable ? { title: nextPlayable.ep.title, onPlay: () => playEpisode(nextPlayable) } : null}
            onBack={goBack}
            onSave={onSave}
          />
        ) : (
          <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center">
            <Img src={item.banner} alt="" className="absolute inset-0 h-full w-full opacity-30" />
            <p className="relative text-base font-bold text-orange">Coming Soon</p>
            <p className="relative text-xs text-white/70">This {isMovie ? "movie" : "episode"} isn't available to watch yet.</p>
            <button type="button" onClick={goBack} className="relative rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold">
              Back
            </button>
          </div>
        )}
      </div>

      {/* title + episode name */}
      <div className="px-4 pt-4">
        <h1 className="text-base font-bold leading-tight">{item.title}</h1>
        {current ? (
          <p className="mt-1 text-[13px] text-white/70">
            Season {current.season} · Episode {current.ep.episodeNumber}: {current.ep.title}
          </p>
        ) : (
          meta && <p className="mt-1 text-xs text-[#9E9E9E]">{meta}</p>
        )}
      </div>

      {/* Up next (series) */}
      {upNext.length > 0 && (
        <section className="pt-5">
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
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{e.ep.title}</p>
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
      <div className="pb-8">
        <ExploreRow title="EXPLORE MORE" items={exploreRow} loading={catalog.loading} compact />
      </div>
    </AppShell>
  );
}

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
    <div className="mx-auto mt-6 flex flex-wrap items-start justify-between gap-6" style={{ maxWidth: "min(100%, calc((100vh - 9rem) * 16 / 9))" }}>
      <div className="min-w-0 max-w-[48rem] flex-1">
        <h1 className="text-[2rem] font-black leading-tight">{item.title}</h1>
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
