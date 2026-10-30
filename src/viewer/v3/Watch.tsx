// v3 Player screen (notes 05): sticky 16:9 player with gestures, title, one-time gesture tip,
// Up next (series) and "Because you watched". Resume / progress saving is the same as the classic page.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Pointer, X } from "lucide-react";
import { api, ApiEpisode } from "@v/lib/api";
import { episodeUrl, Item, NoVideo, noVideoReason } from "@v/lib/content";
import { storage } from "@v/lib/storage";
import { useAuth } from "@v/lib/auth";
import { useCatalog } from "@v/hooks/useCatalog";
import { VideoPlayer } from "@v/components/player/VideoPlayer";
import { episodeThumb } from "@v/components/detail/EpisodeList";
import { useMovieQuery, useSeriesQuery } from "@v/components/detail/queries";
import { useGoBack } from "@v/hooks/useGoBack";
import { durText, GOLD, GOLD_INK, HRow, Pic, Shell, Spinner, useOpenDetail, RED } from "./ui";
import { similarTo } from "./play";
import { AppSheet } from "./Detail";
import { isPro } from "./pro";

interface FlatEpisode {
  ep: ApiEpisode;
  season: number;
}

const toSkip = (s?: { start?: number; end?: number }) =>
  s && (s.end || 0) > (s.start || 0) ? { start: s.start || 0, end: s.end || 0 } : undefined;

const sessionPos = new Map<string, number>();

interface MediaCtx {
  item: Item;
  episodes: FlatEpisode[];
}

const tipSeen = () => {
  try {
    return localStorage.getItem("gp_gesture_tip") === "1";
  } catch {
    return true;
  }
};

export default function WatchV3() {
  const { kind = "", id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { isLoggedIn, token } = useAuth();
  const queryClient = useQueryClient();
  const catalog = useCatalog();

  const isMovie = kind === "movie";
  const isSeries = kind === "series";
  const movieQ = useMovieQuery(id, isMovie);
  const seriesQ = useSeriesQuery(id, isSeries);
  const q = isMovie ? movieQ : seriesQ;
  const item: Item | undefined = q.data;

  const epParam = params.get("ep");
  const tParam = Math.max(0, Number(params.get("t")) || 0);

  const [appOnly, setAppOnly] = useState(false);

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

  const openDetail = useOpenDetail();
  const similar = useMemo(() => (item ? similarTo(item, catalog.everything, 15) : []), [item, catalog.everything]);
  const [tip, setTip] = useState(() => !tipSeen());
  const [playerErr, setPlayerErr] = useState(false);
  useEffect(() => {
    const off = () => setTip(false);
    window.addEventListener("gp-gesture-tip", off);
    const err = (e: Event) => setPlayerErr(!!(e as CustomEvent).detail);
    window.addEventListener("gp-player-error", err);
    return () => {
      window.removeEventListener("gp-gesture-tip", off);
      window.removeEventListener("gp-player-error", err);
    };
  }, []);
  const closeTip = () => {
    setTip(false);
    try {
      localStorage.setItem("gp_gesture_tip", "1");
    } catch {
      /* ignore */
    }
  };

  /* ── states ── */
  if (!isMovie && !isSeries) return <Navigate to="/" replace />;
  if (q.isLoading) {
    return (
      <Shell>
        <div style={{ paddingTop: "var(--st)", background: "#000" }}>
          <div style={{ display: "flex", aspectRatio: "16/9", alignItems: "center", justifyContent: "center", background: "#000" }}>
            <Spinner />
          </div>
        </div>
        <div style={{ padding: "18px 18px 0" }}>
          <div className="shim" style={{ height: 24, width: "60%", borderRadius: 8 }} />
          <div className="shim" style={{ marginTop: 10, height: 13, width: "40%", borderRadius: 6 }} />
        </div>
      </Shell>
    );
  }
  if (q.error || !item) {
    return (
      <Shell ambient>
        <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 40px", textAlign: "center" }}>
          <p style={{ margin: 0, font: "700 18px/1.3 Outfit,sans-serif" }}>Couldn't open this video</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" onClick={goBack} style={{ height: 44, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "#F5F5F5", font: "700 14px/1 'DM Sans',sans-serif" }}>
              Back
            </button>
            <button type="button" onClick={() => q.refetch()} style={{ height: 44, padding: "0 20px", borderRadius: 999, border: 0, background: RED, color: "#fff", font: "700 14px/1 'DM Sans',sans-serif" }}>
              Try again
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const locked = !item.isFree && !isPro();
  const epName = current && current.ep.title && !/^(ep|episode)\.?\s*\d+$/i.test(current.ep.title.trim()) ? current.ep.title : "";
  const subtitle = current ? [`S${current.season} E${current.ep.episodeNumber}`, epName].filter(Boolean).join(" · ") : undefined;
  const skipIntro = isMovie ? item.skipIntro : toSkip(current?.ep.skipIntro);
  const meta = current
    ? [`Season ${current.season} · Episode ${current.ep.episodeNumber}`, item.genres.slice(0, 2).join(" · ")].filter(Boolean).join(" · ")
    : [item.year, durText(item.durationMin), item.genres.slice(0, 2).join(" · "), item.age].filter(Boolean).join(" · ");

  return (
    <Shell>
      <div style={{ paddingBottom: 40, animation: "gpFade .4s both" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 30, background: "#000", paddingTop: "var(--st)" }}>
          {locked ? (
            <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "#000" }}>
              <Pic src={item.banner} style={{ opacity: 0.45 }} fallback={false} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 24px", textAlign: "center" }}>
                <Crown size={28} color={GOLD} />
                <p style={{ margin: 0, font: "600 14px/1.4 'DM Sans',sans-serif" }}>Included with Gutargoo+ Premium</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={goBack} style={{ height: 40, padding: "0 16px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#fff", font: "700 13px/1 'DM Sans',sans-serif" }}>
                    Back
                  </button>
                  <button type="button" onClick={() => navigate("/plans")} style={{ height: 40, padding: "0 16px", borderRadius: 999, border: 0, background: GOLD, color: GOLD_INK, font: "700 13px/1 'DM Sans',sans-serif" }}>
                    See plans
                  </button>
                </div>
              </div>
            </div>
          ) : src ? (
            <VideoPlayer
              key={item.id}
              src={src}
              mediaId={mediaId}
              title={item.title}
              subtitle={subtitle}
              startAt={startAt}
              lateStartAt={lateStartAt}
              skipIntro={skipIntro}
              next={nextPlayable ? { title: nextPlayable.ep.title && !/^(ep|episode)\.?\s*\d+$/i.test(nextPlayable.ep.title.trim()) ? `Episode ${nextPlayable.ep.episodeNumber} · ${nextPlayable.ep.title}` : `Episode ${nextPlayable.ep.episodeNumber}`, onPlay: () => playEpisode(nextPlayable) } : null}
              onBack={goBack}
              onSave={onSave}
            />
          ) : (
            <div style={{ position: "relative", display: "flex", aspectRatio: "16/9", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#000", padding: "0 24px", textAlign: "center" }}>
              <Pic src={item.banner} style={{ opacity: 0.3 }} fallback={false} />
              <p style={{ position: "relative", margin: 0, font: "700 16px/1.2 Outfit,sans-serif" }}>{noVid === "none" ? "Coming soon" : "Video can't play right now"}</p>
              <p style={{ position: "relative", margin: 0, font: "400 13px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.75)" }}>
                <span style={{ color: "#FF8A7D", fontWeight: 700 }}>Reason: </span>
                {noVid === "processing"
                  ? "the video is still being processed on Bunny. It will play in a few minutes."
                  : noVid === "failed"
                    ? "Bunny couldn't process this video file. It needs to be uploaded again from Admin."
                    : `no video file has been added for this ${isMovie ? "movie" : "episode"} yet.`}
              </p>
              <button type="button" onClick={goBack} style={{ position: "relative", height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#fff", font: "700 13px/1 'DM Sans',sans-serif" }}>
                Back
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: "18px 18px 0" }}>
          <h1 onClick={() => openDetail(item)} style={{ margin: 0, font: "800 24px/1.1 Outfit,sans-serif", cursor: "pointer", overflowWrap: "anywhere" }}>{item.title}</h1>
          {meta && <p style={{ margin: "6px 0 0", font: "500 13px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>{meta}</p>}
        </div>

        {tip && src && !locked && !playerErr && (
          <div className="glass" style={{ margin: "14px 18px 0", display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 6px 12px 14px", borderRadius: 14, animation: "gpRise .4s both" }}>
            <span style={{ display: "flex", paddingTop: 1, color: RED }}>
              <Pointer size={18} />
            </span>
            <p style={{ flex: 1, margin: 0, font: "400 13px/1.45 'DM Sans',sans-serif", color: "rgba(245,245,245,.78)" }}>
              <b style={{ color: "#F5F5F5" }}>Gestures:</b> double-tap left or right to skip 10s. Swipe up or down on the left for brightness, on the right for volume.
            </p>
            <button type="button" aria-label="Dismiss" onClick={closeTip} style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "transparent", color: "rgba(245,245,245,.7)" }}>
              <X size={16} />
            </button>
          </div>
        )}

        {upNext.length > 0 && (
          <section style={{ marginTop: 18 }}>
            <h3 style={{ margin: 0, padding: "0 18px", font: "700 17px/1.2 Outfit,sans-serif" }}>Up next</h3>
            {upNext.map((e, i) => {
              const ok = !!episodeUrl(e.ep);
              const d = Number(e.ep.videoFile?.duration) || 0;
              return (
                <div
                  key={e.ep._id}
                  onClick={() => ok && playEpisode(e)}
                  role={ok ? "button" : undefined}
                  tabIndex={ok ? 0 : undefined}
                  style={{ display: "flex", gap: 14, padding: "12px 18px", cursor: ok ? "pointer" : "default", opacity: ok ? 1 : 0.6, animation: `gpRise .4s ${Math.min(i, 6) * 0.04}s both` }}
                >
                  <div style={{ position: "relative", width: 120, height: 68, flexShrink: 0, borderRadius: 10, overflow: "hidden", background: "#1C1C1C" }}>
                    <Pic src={episodeThumb(e.ep, item.banner)} pos="center 30%" style={{ filter: ok ? "none" : "grayscale(1) brightness(.6)" }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="clamp2" style={{ margin: 0, font: "600 14px/1.3 'DM Sans',sans-serif" }}>
                      {e.ep.title && !/^(ep|episode)\.?\s*\d+$/i.test(e.ep.title.trim()) ? `${e.ep.episodeNumber}. ${e.ep.title}` : `Episode ${e.ep.episodeNumber}`}
                    </p>
                    <p style={{ margin: "4px 0 0", font: "400 12px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>
                      {ok ? [`S${e.season}`, d ? `${Math.max(1, Math.round(d / 60))}m` : ""].filter(Boolean).join(" · ") : "Coming soon"}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {similar.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h3 style={{ margin: 0, padding: "0 18px", font: "700 17px/1.2 Outfit,sans-serif" }}>Because you watched {item.title}</h3>
            <HRow>
              {similar.map((x) => (
                <div key={x.id} className="press" onClick={() => openDetail(x)} role="link" tabIndex={0} style={{ flexShrink: 0, width: 112, cursor: "pointer" }}>
                  <div style={{ position: "relative", height: 166, borderRadius: 12, overflow: "hidden", background: "#1C1C1C" }}>
                    <Pic src={x.poster} alt={x.title} />
                  </div>
                  <p style={{ margin: "8px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 13px/1.3 'DM Sans',sans-serif" }}>{x.title}</p>
                </div>
              ))}
            </HRow>
          </section>
        )}
      </div>
      <AppSheet open={appOnly} onClose={() => setAppOnly(false)} />
    </Shell>
  );
}
