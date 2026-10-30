// Potli (notes 02): full-screen vertical trailer feed, Shorts style. Only the visible clip plays,
// the next ones preload muted, a "Watch now" card grows in after N seconds (admin setting).
import { memo, MutableRefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkCheck, BookmarkPlus, ChevronRight, Crown, Heart, Play, Search, Send, Volume2, VolumeX } from "lucide-react";
import { useCatalog } from "@v/hooks/useCatalog";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useHls } from "@v/components/player/useHls";
import type { Item } from "@v/lib/content";
import { EASE, GOLD, GOLD_INK, PremiumBadge, Shell, TOP, useOpenDetail, useV3Toast, Spinner, seasonsText, durText } from "./ui";
import { useContinue } from "./useContinue";
import { playTarget } from "./play";
import { useHomeSettings } from "./useSettings";
import { compact, shareTitle, useLike } from "./likes";
import { useFounder } from "./founder";

type Feed = "for" | "tr";
const MUTE_KEY = "gp_potli_muted";
const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
};
const writeMuted = (m: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignore */
  }
};
const IMAGE_CLIP_SEC = 30;
const STATE_KEY = "gp_potli_state";
const readState = (): { feed: Feed; idx: number; id: string } => {
  try {
    const v = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
    return { feed: v.feed === "tr" ? "tr" : "for", idx: Math.max(0, Number(v.idx) || 0), id: typeof v.id === "string" ? v.id : "" };
  } catch {
    return { feed: "for", idx: 0, id: "" };
  }
};

export default function Potli() {
  const { everything, loading } = useCatalog();
  const settings = useHomeSettings();
  const toast = useV3Toast();
  const navigate = useNavigate();
  const saved = useRef(readState());
  const [feed, setFeed] = useState<Feed>(saved.current.feed);
  const [idx, setIdx] = useState(saved.current.idx);
  const [blocked, setBlocked] = useState(false); // browser started the clip muted (autoplay rule)
  const activeVideo = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(readMuted);
  const [gesture, setGesture] = useState(false); // browsers allow sound only after a tap
  const scrollRef = useRef<HTMLDivElement>(null);

  const setMuted = (m: boolean) => {
    setMutedState(m);
    writeMuted(m);
  };

  // the clips: trailers first ("For you" = most watched + liked first), titles without a trailer show their poster
  const clips = useMemo(() => {
    const withTrailer = everything.filter((x) => !!x.trailerUrl);
    if (feed === "tr") return [...withTrailer].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const ranked = [...withTrailer].sort((a, b) => b.views - a.views);
    const rest = everything.filter((x) => !x.trailerUrl && x.poster).sort((a, b) => b.views - a.views);
    return [...ranked, ...rest].slice(0, 40);
  }, [everything, feed]);

  // which clip is on screen
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    setIdx((cur) => {
      if (cur !== i) setPaused(false); // swiping to a new clip un-pauses
      return i;
    });
  }, []);

  // back from a title → same feed, same clip
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || !clips.length || loading) return; // wait for the whole catalog (order changes while it loads)
    restored.current = true;
    const el = scrollRef.current;
    const byId = saved.current.id ? clips.findIndex((c) => c.id === saved.current.id) : -1;
    const i = byId >= 0 ? byId : Math.min(saved.current.idx, clips.length - 1);
    if (el && i > 0) {
      el.scrollTop = i * el.clientHeight;
      // a fresh page load can still shift the feed while pictures/fonts settle: hold the clip until the user swipes
      let touched = false;
      const mark = () => (touched = true);
      el.addEventListener("touchstart", mark, { once: true, passive: true });
      el.addEventListener("wheel", mark, { once: true, passive: true });
      [60, 250, 600, 1200].forEach((ms) => window.setTimeout(() => { if (!touched && el.isConnected) el.scrollTop = i * el.clientHeight; }, ms));
    }
    setIdx(i);
  }, [clips.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!restored.current) return; // don't overwrite the saved clip before it's restored
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ feed, idx, id: clips[idx]?.id || "" }));
    } catch {
      /* ignore */
    }
  }, [feed, idx, clips]);
  const firstFeed = useRef(true);
  useEffect(() => {
    if (firstFeed.current) {
      firstFeed.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    setIdx(0);
    setPaused(false);
  }, [feed]);

  // sound needs a real tap (click), and on iPhone the play() call must happen inside it
  const soundOn = () => {
    setGesture(true);
    setBlocked(false);
    const v = activeVideo.current;
    if (v) {
      v.muted = false;
      v.play().catch(() => {});
    }
  };

  const next = useCallback((from: number) => {
    const el = scrollRef.current;
    if (!el || from >= clips.length - 1) return;
    el.scrollTo({ top: (from + 1) * el.clientHeight, behavior: "smooth" });
  }, [clips.length]);


  return (
    <Shell nav style={{ height: "100dvh", overflow: "hidden" }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onClickCapture={() => !gesture && setGesture(true)}
        className="noscroll"
        style={{ position: "relative", height: "100dvh", overflowY: "auto", overflowX: "hidden", scrollSnapType: "y mandatory", overflowAnchor: "none", overscrollBehavior: "contain", background: "#000", animation: "gpFade .4s both" }}
      >
        {/* header over the video */}
        <div style={{ position: "sticky", top: 0, zIndex: 30, height: 0 }}>
          <header style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 44px", alignItems: "start", height: `calc(var(--st) + 94px)`, padding: `var(--st) 10px 0`, background: "linear-gradient(to bottom,rgba(0,0,0,.62),rgba(0,0,0,.28) 55%,transparent)" }}>
            <button
              type="button"
              aria-label={muted ? "Sound on" : "Sound off"}
              onClick={() => {
                const off = muted || !gesture || blocked;
                setMuted(!off);
                if (off) soundOn();
                else if (activeVideo.current) activeVideo.current.muted = true;
              }}
              className="press press-s"
              style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color: "#fff", filter: "drop-shadow(0 1px 4px rgba(0,0,0,.6))" }}
            >
              {muted || !gesture || blocked ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <div style={{ display: "flex", justifyContent: "center", gap: "clamp(10px, 4.5vw, 22px)", minWidth: 0 }}>
              {(
                [
                  ["for", "For you"],
                  ["tr", "Trailers"],
                  ["dr", "Dramas"],
                ] as const
              ).map(([k, label]) => {
                const on = feed === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (k === "dr" ? toast("Short dramas are coming to Potli soon") : setFeed(k))}
                    style={{ position: "relative", flexShrink: 0, whiteSpace: "nowrap", height: 44, border: 0, background: "transparent", padding: 0, color: on ? "#fff" : "rgba(255,255,255,.7)", font: `${on ? 700 : 600} 16px/1 'DM Sans',sans-serif`, letterSpacing: -0.1, textShadow: "0 1px 8px rgba(0,0,0,.55)", transition: "color .25s" }}
                  >
                    {label}
                    <span style={{ position: "absolute", left: "50%", bottom: 6, height: 2, width: 16, marginLeft: -8, borderRadius: 999, background: "#fff", opacity: on ? 1 : 0, transition: "opacity .25s" }} />
                  </button>
                );
              })}
            </div>
            <button type="button" aria-label="Search" onClick={() => navigate("/search")} style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color: "#fff", filter: "drop-shadow(0 1px 4px rgba(0,0,0,.6))" }}>
              <Search size={22} />
            </button>
          </header>
        </div>

        {blocked && !muted && (
          <div style={{ position: "sticky", top: 0, zIndex: 31, height: 0 }}>
            <button type="button" onClick={soundOn} style={{ position: "absolute", left: "50%", top: "calc(var(--st) + 54px)", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", color: "#fff", font: "600 12px/1 'DM Sans',sans-serif", whiteSpace: "nowrap", animation: "gpFade .3s both" }}>
              <VolumeX size={14} /> Tap for sound
            </button>
          </div>
        )}
        {loading && !clips.length ? (
          <div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}>
            <Spinner />
          </div>
        ) : !clips.length ? (
          <div style={{ display: "flex", height: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 40px", textAlign: "center" }}>
            <p style={{ margin: 0, font: "700 18px/1.3 Outfit,sans-serif" }}>No trailers yet</p>
            <p style={{ margin: 0, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>New trailers land here first. Meanwhile, browse everything on Home.</p>
            <button type="button" onClick={() => navigate("/")} style={{ marginTop: 10, height: 44, padding: "0 22px", borderRadius: 999, border: 0, background: "#F5F5F5", color: "#000", font: "700 14px/1 'DM Sans',sans-serif" }}>
              Go to Home
            </button>
          </div>
        ) : (
          clips.map((it, i) =>
            Math.abs(i - idx) <= 3 ? (
              <Clip
                key={`${feed}-${it.id}`}
                it={it}
                index={i}
                active={i === idx}
                near={i >= idx - 1 && i <= idx + 2}
                paused={i === idx && paused}
                muted={muted || !gesture || blocked}
                ctaDelay={settings.potliCtaSeconds}
                activeVideo={activeVideo}
                onTogglePause={() => {
                  setGesture(true);
                  setPaused((p) => !p);
                }}
                onEnded={next}
                onAutoMuted={() => setBlocked(true)}
              />
            ) : (
              <div key={`${feed}-${it.id}`} style={{ height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always", background: "#000" }} />
            )
          )
        )}
      </div>
    </Shell>
  );
}

/* ───────── one clip ───────── */
interface ClipProps {
  it: Item;
  index: number;
  active: boolean;
  near: boolean;
  paused: boolean;
  muted: boolean;
  ctaDelay: number;
  activeVideo: MutableRefObject<HTMLVideoElement | null>;
  onTogglePause: () => void;
  onEnded: (index: number) => void;
  onAutoMuted: () => void;
}

const Clip = memo(function Clip({ it, index, active, near, paused, muted, ctaDelay, activeVideo, onTogglePause, onEnded, onAutoMuted }: ClipProps) {
  const navigate = useNavigate();
  const openDetail = useOpenDetail();
  const toast = useV3Toast();
  const { byId } = useCatalog();
  const cw = useContinue(byId);
  const { has, toggle } = useWatchlist();
  const like = useLike(active ? it : null, active);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const useVideo = !!it.trailerUrl && !videoFailed;
  const { error } = useHls(videoRef, useVideo && near ? it.trailerUrl : null, { autoPlay: false }, `potli-${it.id}`);
  useEffect(() => {
    if (error) setVideoFailed(true);
  }, [error]);
  useEffect(() => {
    if (!near) setReady(false); // the <video> goes away → show the poster again when it comes back
  }, [near]);
  useEffect(() => {
    if (active) activeVideo.current = videoRef.current;
    else if (activeVideo.current === videoRef.current) activeVideo.current = null;
  });

  // only the visible clip plays
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo) return;
    v.muted = muted || !active;
    if (active && !paused) {
      const p = v.play();
      p?.catch((e: DOMException) => {
        if (e?.name === "NotAllowedError" && !v.muted) {
          v.muted = true;
          onAutoMuted();
          v.play().catch(() => {});
        }
      });
    } else {
      v.pause();
      if (!active) {
        try {
          if (v.currentTime > 0) v.currentTime = 0;
        } catch {
          /* ignore */
        }
        setProgress(0);
      }
    }
  }, [active, paused, muted, useVideo, near, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Watch now" after N seconds of playing (the timer pauses with the clip)
  const [played, setPlayed] = useState(0);
  useEffect(() => {
    if (!active) {
      setPlayed(0);
      return;
    }
    if (paused) return;
    const t = window.setInterval(() => {
      const v = videoRef.current;
      if (useVideo && v && (v.paused || v.readyState < 3)) return; // still loading → don't count
      setPlayed((s) => s + 0.25);
    }, 250);
    return () => window.clearInterval(t);
  }, [active, paused, useVideo]);
  const showCta = active && played >= ctaDelay;

  const t = playTarget(it, cw);
  const locked = t.locked;
  const series = it.kind !== "movie";
  const inList = has(it.id);
  const meta = [it.genres.slice(0, 2).join(" · "), it.year, it.age].filter(Boolean).join("  ·  ");
  const offer = useFounder().data;
  const sub = locked ? (offer?.active && offer.left > 0 ? `Free Premium for the first ${offer.limit.toLocaleString("en-IN")}` : "Premium title") : series ? `${it.seasons.length ? seasonsText(it.seasons.length) : "Series"} · Free` : `${durText(it.durationMin) || "Movie"} · Free`;
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div style={{ position: "relative", height: "100dvh", overflow: "hidden", background: "#000", scrollSnapAlign: "start", scrollSnapStop: "always" }}>
      {/* poster (also behind the video while it loads) */}
      <img
        src={it.bigVertical || it.poster || it.banner}
        alt=""
        draggable={false}
        loading={near ? "eager" : "lazy"}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${active && !paused && !useVideo ? 1.12 : 1.02})`, transition: "transform 30s linear" }}
      />
      {useVideo && near && (
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          muted
          loop={false}
          disablePictureInPicture
          controlsList="nodownload noremoteplayback"
          onLoadedData={() => setReady(true)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setProgress(v.currentTime / v.duration);
          }}
          onEnded={() => active && onEnded(index)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: ready ? 1 : 0, transition: "opacity .4s" }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 52%,rgba(0,0,0,.7) 80%,rgba(0,0,0,.94))", pointerEvents: "none" }} />
      <div onClick={onTogglePause} style={{ position: "absolute", inset: 0, cursor: "pointer" }} aria-label={paused ? "Play" : "Pause"} role="button" />
      {paused && (
        <div style={{ position: "absolute", left: "50%", top: "50%", display: "flex", height: 76, width: 76, margin: "-38px 0 0 -38px", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(0,0,0,.42)", backdropFilter: "blur(8px)", color: "#fff", paddingLeft: 4, pointerEvents: "none", animation: "gpPop .3s both" }}>
          <Play size={32} fill="currentColor" />
        </div>
      )}

      {/* right rail */}
      <div style={{ position: "absolute", right: 6, bottom: "calc(108px + var(--sb))", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <RailBtn label="Like" onClick={stop(() => like.toggle())} color={like.liked ? "#EF4130" : "#fff"} text={like.count ? compact(like.count) : like.liked ? "Liked" : "Like"}>
          <Heart size={29} strokeWidth={1.8} fill={like.liked ? "currentColor" : "none"} />
        </RailBtn>
        <RailBtn
          label="My List"
          onClick={stop(() => {
            const added = toggle(it);
            toast(added ? `Added “${it.title}” to My List` : `Removed “${it.title}” from My List`, added ? undefined : () => toggle(it));
          })}
          color={inList ? "#EF4130" : "#fff"}
          text={inList ? "Saved" : "Save"}
        >
          {inList ? <BookmarkCheck size={28} strokeWidth={1.8} /> : <BookmarkPlus size={28} strokeWidth={1.8} />}
        </RailBtn>
        <RailBtn label="Share" onClick={stop(() => shareTitle(it, toast))} color="#fff" text="Share">
          <Send size={26} strokeWidth={1.8} />
        </RailBtn>
      </div>

      {/* title block */}
      <div style={{ position: "absolute", left: 16, right: 76, bottom: "calc(110px + var(--sb))", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {locked && <PremiumBadge />}
          <span style={{ font: "700 11px/1 'DM Sans',sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.8)" }}>
            {series ? "Series" : "Movie"}{it.trailerUrl ? " · Trailer" : ""}
          </span>
        </div>
        <button type="button" onClick={() => openDetail(it)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, padding: 0, border: 0, background: "transparent", color: "#fff", font: "800 26px/1.05 Outfit,sans-serif", letterSpacing: -0.4, textAlign: "left", pointerEvents: "auto" }}>
          <span style={{ overflowWrap: "anywhere" }}>{it.title}</span>
          <ChevronRight size={22} strokeWidth={2.4} style={{ flexShrink: 0 }} />
        </button>
        {meta && <p style={{ margin: "6px 0 0", font: "500 13px/1.4 'DM Sans',sans-serif", color: "rgba(255,255,255,.82)" }}>{meta}</p>}
        {showCta && (
          <div style={{ overflow: "hidden", pointerEvents: "auto", animation: `gpCta .6s ${EASE} both` }}>
            <div className="glass v3-cta" style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 18, background: "rgba(18,18,18,.62)", border: "1px solid rgba(255,255,255,.12)" }}>
              <img src={it.poster} alt="" style={{ height: 52, width: 40, flexShrink: 0, borderRadius: 9, objectFit: "cover" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, font: "700 13px/1.25 'DM Sans',sans-serif", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{locked ? "Watch with Premium" : series ? "Full series on Gutargoo+" : "Full movie on Gutargoo+"}</p>
                <p style={{ margin: "3px 0 0", font: "500 11.5px/1.3 'DM Sans',sans-serif", color: "rgba(255,255,255,.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</p>
              </div>
              <button
                type="button"
                onClick={stop(() => (t.path ? navigate(t.path) : openDetail(it)))}
                className="press"
                style={{ display: "flex", height: 40, flexShrink: 0, alignItems: "center", gap: 6, padding: "0 14px", borderRadius: 12, border: 0, background: locked ? GOLD : "#F5F5F5", color: locked ? GOLD_INK : "#000", font: "700 13px/1 'DM Sans',sans-serif" }}
              >
                {locked ? <Crown size={14} /> : <Play size={14} fill="currentColor" />}
                {locked ? "Unlock" : "Watch now"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* progress line just above the nav */}
      {active && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(92px + var(--sb))", height: 2, background: "rgba(255,255,255,.18)" }}>
          {useVideo ? (
            <span style={{ position: "absolute", inset: 0, background: "#fff", transformOrigin: "left", transform: `scaleX(${progress})`, transition: "transform .25s linear" }} />
          ) : (
            <span
              className="no-rm"
              onAnimationEnd={() => onEnded(index)}
              style={{ position: "absolute", inset: 0, background: "#fff", transformOrigin: "left", animation: `gpFill ${IMAGE_CLIP_SEC}s linear both`, animationPlayState: paused ? "paused" : "running" }}
            />
          )}
        </div>
      )}
    </div>
  );
});

function RailBtn({ label, onClick, color, text, children }: { label: string; onClick: (e: React.MouseEvent) => void; color: string; text: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 56, border: 0, background: "transparent", color, font: "600 12px/1 'DM Sans',sans-serif", filter: "drop-shadow(0 1px 4px rgba(0,0,0,.55))" }}
    >
      {children}
      <span style={{ color: "#fff" }}>{text}</span>
    </button>
  );
}
