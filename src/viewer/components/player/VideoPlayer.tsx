// The full player (app's video_screen): HLS video, auto-hiding controls, double-tap seek,
// settings, fullscreen, Skip Intro, Next episode, keyboard shortcuts and progress callbacks.
// One instance can play several sources in a row (next episode): when `src` changes it saves the
// old one, resets and loads the new one — so fullscreen stays on between episodes.
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import clsx from "clsx";
import { ChevronsLeft, ChevronsRight, Loader2, Play, SkipForward, Sun, Volume1, Volume2, VolumeX, X } from "lucide-react";
import "../../v3/v3.css";
import { useHls } from "./useHls";
import { PlayerControls } from "./PlayerControls";
import { SettingsSheet } from "./SettingsSheet";
import { enterFullscreen, exitFullscreen, fullscreenElement, onFullscreenChange, unlockOrientation } from "./fullscreen";

export interface VideoPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  /** where to start (read once, when the video loads) */
  startAt?: number;
  /** a resume point that may arrive after loading (the server's): seeks once, only while the viewer
   *  hasn't seeked and is still in the first 3 s */
  lateStartAt?: number;
  /** what is playing (episode / movie id) — handed back with every save so it is saved for the right one */
  mediaId?: string;
  skipIntro?: { start: number; end: number };
  next?: { title: string; onPlay: () => void } | null;
  onBack: () => void;
  /** called every 15 s while playing, on pause, on end, when the source changes and when the player closes.
   *  `urgent` = the tab is being hidden / closed (use a request that survives the page going away) */
  onSave?: (seconds: number, duration: number, completed: boolean, mediaId: string | undefined, urgent: boolean) => void;
}

const HIDE_AFTER = 3000;
const IOS = typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const SAVE_EVERY = 10000; // notes 05: save the watch position every 10 s and on exit

export function VideoPlayer({ src, title, subtitle, startAt = 0, lateStartAt = 0, mediaId, skipIntro, next, onBack, onSave }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [visible, setVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [chip, setChip] = useState<{ side: "left" | "right"; key: number; n: number } | null>(null);
  const chipRef = useRef<{ side: "left" | "right"; t: number; n: number } | null>(null);
  const [bright, setBright] = useState(1); // brightness = black overlay, max 75 %
  const [vol, setVol] = useState(1);
  const [hud, setHud] = useState<"b" | "v" | null>(null);
  const [nextCancelled, setNextCancelled] = useState(false);
  const nextCancelledRef = useRef(false);
  nextCancelledRef.current = nextCancelled;

  /* ── progress saving ── */
  // last GOOD position: only taken from a loaded video without an error (tearing a source down
  // fires a "timeupdate" at 0, which must not wipe the point Retry / the closing save use)
  const timeRef = useRef(0);
  const durRef = useRef(0);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const mediaRef = useRef(mediaId); // what is loaded right now (changes together with src, in the effect below)
  const lastSavedRef = useRef(-1);
  const save = useCallback((completed = false, urgent = false) => {
    const t = timeRef.current;
    const d = durRef.current;
    if (!saveRef.current || t < 1) return;
    if (!completed && !urgent && Math.floor(t) === lastSavedRef.current) return;
    lastSavedRef.current = Math.floor(t);
    saveRef.current(t, d, completed || (d > 0 && t >= d - 1), mediaRef.current, urgent);
  }, []);

  /* ── a new source: save the old one, then start clean (declared before useHls so it runs first) ── */
  const startAtRef = useRef(startAt);
  startAtRef.current = startAt;
  const startApplied = useRef(false);
  const lateApplied = useRef(false);
  const userSeeked = useRef(false);
  const switching = useRef(true); // a source is being (re)loaded: the old one's "pause" must not hide the spinner
  const resumeAt = useRef<number | null>(null); // position to return to after Retry
  useEffect(() => {
    mediaRef.current = mediaId;
    startApplied.current = false;
    lateApplied.current = false;
    userSeeked.current = false;
    switching.current = true;
    resumeAt.current = null;
    timeRef.current = 0;
    durRef.current = 0;
    lastSavedRef.current = -1;
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setBuffering(true);
    // the old source is torn down without a "pause" event (hls.js detach) → don't keep showing "playing"
    setPlaying(false);
    setChip(null);
    setNextCancelled(false);
    return () => save(); // still the old source here
  }, [src, mediaId, save]);

  const { levels, level, setLevel, error, errorDetail, reason, checking, retry: reload, source } = useHls(videoRef, src, {
    autoPlay: true,
    // browsers block autoplay with sound unless the user just tapped — start muted instead
    onAutoplayBlocked: (v) => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setBuffering(false)); // still refused (e.g. iPhone low-power) → show the play button
    },
    onPlayRejected: () => setBuffering(false),
  }, mediaId);

  const errorRef = useRef(error);
  useEffect(() => { window.dispatchEvent(new CustomEvent("gp-player-error", { detail: !!error })); }, [error]);
  errorRef.current = error;

  // the player quietly moved to a backup source (see useHls) → continue from the same point
  const firstSource = useRef(true);
  useEffect(() => {
    if (firstSource.current) {
      firstSource.current = false;
      return;
    }
    if (timeRef.current > 1) resumeAt.current = timeRef.current;
    startApplied.current = false;
    switching.current = true;
    setBuffering(true);
  }, [source]);

  // Retry after an error: reload and continue from where it stopped
  const retry = useCallback(() => {
    resumeAt.current = timeRef.current > 1 ? timeRef.current : null;
    startApplied.current = false;
    switching.current = true;
    setBuffering(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => save(), SAVE_EVERY);
    return () => window.clearInterval(id);
  }, [playing, save]);

  useEffect(() => {
    // tab hidden / page closing: save right away with a request that outlives the page
    const onHide = () => document.visibilityState === "hidden" && save(false, true);
    const onPageHide = () => save(false, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      save(); // player closing
    };
  }, [save]);

  /* ── auto-hide controls ── */
  const hideTimer = useRef<number>();
  const keepOpenRef = useRef(false);
  keepOpenRef.current = settingsOpen || !playing;
  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!keepOpenRef.current) setVisible(false);
    }, HIDE_AFTER);
  }, []);
  useEffect(() => {
    if (playing && !settingsOpen) poke();
    else setVisible(true);
  }, [playing, settingsOpen, poke]);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  /* ── actions ── */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      v.play().catch(() => {});
    } else v.pause();
  }, []);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    userSeeked.current = true;
    setNextCancelled(false);
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    v.currentTime = Math.max(0, d ? Math.min(t, d - 0.5) : t);
    setCurrent(v.currentTime);
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (v) seekTo(v.currentTime + delta);
  }, [seekTo]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  // The whole site may already be fullscreen ("TV mode"). Then the player still goes fullscreen
  // on top of it, and leaving player fullscreen returns to the fullscreen site.
  const backToDocFs = useRef(false);
  const exitPlayerFs = useCallback(() => {
    if (fullscreenElement() === containerRef.current) exitFullscreen();
  }, []);
  const toggleFs = useCallback(() => {
    const fsEl = fullscreenElement();
    if (fsEl && fsEl === containerRef.current) {
      exitFullscreen();
      return;
    }
    backToDocFs.current = fsEl === document.documentElement;
    enterFullscreen(containerRef.current, videoRef.current);
  }, []);

  useEffect(
    () =>
      onFullscreenChange(() => {
        const el = fullscreenElement();
        const fs = !!el && el === containerRef.current;
        setIsFs(fs);
        if (fs) return;
        unlockOrientation();
        if (backToDocFs.current) {
          backToDocFs.current = false;
          // most browsers return to the fullscreen site by themselves; if not, ask again
          if (!el) document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }),
    []
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  /* ── gestures (notes 05): single tap waits 300 ms (controls / mouse: play-pause), double-tap ±10 s
        (more taps within 800 ms add up), vertical drag: left = brightness, right = volume ── */
  const showSeekFx = useCallback((side: "left" | "right") => {
    const now = Date.now();
    const prev = chipRef.current;
    const n = prev && prev.side === side && now - prev.t < 800 ? prev.n + 1 : 1;
    chipRef.current = { side, t: now, n };
    setChip({ side, key: now, n });
  }, []);
  const lastTap = useRef<{ t: number; side: "left" | "right" } | null>(null);
  const tapTimer = useRef<number>();
  const hudTimer = useRef<number>();
  const g = useRef<{ x: number; y: number; h: number; left: boolean; moved: boolean; b: number; v: number; mouse: boolean } | null>(null);
  const onSurfaceDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    g.current = { x: e.clientX, y: e.clientY, h: r.height, left: e.clientX - r.left < r.width / 2, moved: false, b: bright, v: videoRef.current?.volume ?? vol, mouse: e.pointerType === "mouse" };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onSurfaceMove = (e: RPointerEvent<HTMLDivElement>) => {
    const st = g.current;
    if (!st || st.mouse) return;
    const dy = e.clientY - st.y;
    const dx = e.clientX - st.x;
    if (!st.moved && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) st.moved = true;
    if (!st.moved) return;
    const val = Math.max(0, Math.min(1, (st.left ? st.b : st.v) - dy / (st.h * 0.9)));
    window.clearTimeout(hudTimer.current);
    if (st.left) {
      setBright(val);
      setHud("b");
    } else {
      const v = videoRef.current;
      if (v) {
        // iPhone / iPad: pages can't change the volume — the drag mutes (down to 0) / unmutes instead
        if (IOS) v.muted = val < 0.05;
        else {
          v.volume = val;
          if (val > 0 && v.muted) v.muted = false;
        }
      }
      setVol(IOS ? (val < 0.05 ? 0 : 1) : val);
      setHud("v");
    }
    hideTip();
  };
  const onSurfaceUp = (e: RPointerEvent<HTMLDivElement>) => {
    const st = g.current;
    g.current = null;
    if (!st) return;
    if (st.moved) {
      window.clearTimeout(hudTimer.current);
      hudTimer.current = window.setTimeout(() => setHud(null), 700);
      return;
    }
    const now = Date.now();
    const side: "left" | "right" = st.left ? "left" : "right";
    const fx = chipRef.current;
    const inBurst = !!fx && fx.side === side && now - fx.t < 800;
    const isDouble = !!lastTap.current && lastTap.current.side === side && now - lastTap.current.t < 300;
    if (inBurst || isDouble) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = null;
      seekBy(side === "left" ? -10 : 10);
      showSeekFx(side);
      setNextCancelled(false);
      hideTip();
      return;
    }
    lastTap.current = { t: now, side };
    const isMouse = e.pointerType === "mouse";
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      lastTap.current = null;
      if (isMouse) {
        togglePlay();
        poke();
      } else if (visible) setVisible(false);
      else poke();
    }, 300);
  };
  useEffect(() => () => (window.clearTimeout(tapTimer.current), window.clearTimeout(hudTimer.current)), []);
  useEffect(() => {
    if (!chip) return;
    const id = window.setTimeout(() => setChip(null), 800);
    return () => window.clearTimeout(id);
  }, [chip]);

  // one-time gesture tip (kept dismissed)
  const hideTip = useCallback(() => {
    try {
      if (localStorage.getItem("gp_gesture_tip") !== "1") {
        localStorage.setItem("gp_gesture_tip", "1");
        window.dispatchEvent(new Event("gp-gesture-tip"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // TV-remote navigation already used this key
      const t = e.target as HTMLElement;
      const box = containerRef.current;
      // ← → seek only when the player itself, the page or the seek bar is focused; a card or a
      // button (also the player's own buttons) is selected → arrows move between them (TV remote)
      const isRange = !!t && t.tagName === "INPUT" && (t as HTMLInputElement).type === "range" && !!box?.contains(t);
      const elsewhere = !!t && t !== document.body && t !== box && !isRange;
      if (t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && (t as HTMLInputElement).type !== "range") || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // TV remotes: OK/Enter plays / pauses when nothing else is selected
      const enterOnPage = (k === "enter" || k === "mediaplaypause") && (!t || t === document.body || t === containerRef.current);
      if (k === " " || k === "k" || enterOnPage) {
        if (k === " " && t?.tagName === "BUTTON") return; // let buttons handle Space themselves
        e.preventDefault();
        togglePlay();
      } else if ((k === "arrowleft" || k === "arrowright") && elsewhere) {
        return;
      } else if (k === "arrowleft") {
        e.preventDefault();
        seekBy(-10);
        showSeekFx("left");
      } else if (k === "arrowright") {
        e.preventDefault();
        seekBy(10);
        showSeekFx("right");
      } else if (k === "f") {
        e.preventDefault();
        toggleFs();
      } else if (k === "m") {
        e.preventDefault();
        toggleMute();
      } else return;
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFs, toggleMute, poke, showSeekFx]);

  /* ── video events ── */
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    durRef.current = d;
    v.playbackRate = speed;
    // only once real metadata is there: tearing down the previous source also fires "durationchange"
    // (duration → NaN, readyState 0) — using that event would spend the start point on an empty video
    if (v.readyState >= 1) switching.current = false;
    if (!startApplied.current && v.readyState >= 1) {
      startApplied.current = true;
      const back = resumeAt.current;
      resumeAt.current = null;
      const start = startAtRef.current;
      if (back !== null && back > 1) {
        lateApplied.current = true;
        if (!d || back < d - 1) v.currentTime = back;
      } else if (start > 5 && (!d || start < d - 10)) {
        lateApplied.current = true;
        v.currentTime = start;
      }
      applyLate();
    }
  };
  // the server's resume point may arrive after loading: seek there once, but only if the viewer
  // hasn't seeked yet and is still in the first 3 s (never jumps back later)
  const lateRef = useRef(lateStartAt);
  lateRef.current = lateStartAt;
  const applyLate = useCallback(() => {
    const v = videoRef.current;
    const at = lateRef.current;
    if (!v || !startApplied.current || lateApplied.current || at <= 5) return;
    lateApplied.current = true;
    if (userSeeked.current || v.currentTime > 3) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    if (!d || at < d - 10) v.currentTime = at;
  }, []);
  useEffect(applyLate, [lateStartAt, applyLate]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    // see timeRef: skip the reset to 0 of a torn-down / failed source and the moment before a Retry seeks back
    if (v.readyState > 0 && !v.error && !errorRef.current && resumeAt.current === null) {
      timeRef.current = v.currentTime;
      // past the first seconds → a late server resume point must not pull the viewer back
      if (v.currentTime > 3 && startApplied.current) lateApplied.current = true;
    }
    const b = v.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= v.currentTime) {
        setBuffered(b.end(i));
        break;
      }
    }
  };
  const onEnded = () => {
    setPlaying(false);
    timeRef.current = durRef.current || timeRef.current;
    save(true);
    if (next && !nextCancelledRef.current) next.onPlay();
  };

  const remaining = duration - current;
  const showSkip = !!skipIntro && current >= skipIntro.start && current < skipIntro.end;
  const showNext = !!next && duration > 0 && remaining <= 15 && remaining > 0 && !nextCancelled;
  const hv = hud === "b" ? bright : muted ? 0 : vol;
  const controlsShown = visible && !hud && !chip;
  // the Up next card appears on a clean picture; a tap still brings the controls back (pause, seek, leave fullscreen)
  const nextShownRef = useRef(false);
  useEffect(() => {
    if (showNext && !nextShownRef.current) setVisible(false);
    nextShownRef.current = showNext;
  }, [showNext]);

  return (
    <div
      ref={containerRef}
      data-player
      data-tv-start
      tabIndex={0}
      aria-label={title ? `Video player: ${title}` : "Video player"}
      onFocus={poke}
      className={clsx("relative w-full select-none overflow-hidden bg-black", isFs ? "h-full" : "aspect-video", !visible && playing && "cursor-none")}
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
      onPointerMove={(e) => e.pointerType === "mouse" && poke()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        playsInline
        preload="auto"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onProgress={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          // Safari / iPhone: the old source's "pause" arrives after the switch started → keep the spinner
          const v = videoRef.current;
          if (!v || v.readyState === 0 || switching.current) return;
          setBuffering(false);
          save();
        }}
        onPlaying={() => {
          switching.current = false;
          setBuffering(false);
        }}
        onCanPlay={() => {
          switching.current = false;
          setBuffering(false);
        }}
        onWaiting={() => {
          if (videoRef.current && !videoRef.current.paused) setBuffering(true);
        }}
        onSeeked={() => setBuffering(false)}
        onEnded={onEnded}
        onVolumeChange={() => videoRef.current && setMuted(videoRef.current.muted)}
      />

      {/* brightness */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-black" style={{ opacity: (1 - bright) * 0.75 }} />

      {/* gesture surface */}
      <div className="absolute inset-0 z-10" onPointerDown={onSurfaceDown} onPointerMove={onSurfaceMove} onPointerUp={onSurfaceUp} onPointerCancel={() => (g.current = null)} />

      {/* double-tap ripple: "10 seconds", "20 seconds"… */}
      {chip && (
        <div
          key={`${chip.side}-${chip.n}`}
          className="pointer-events-none absolute inset-y-0 z-30 flex flex-col items-center justify-center gap-1.5 text-white"
          style={{
            [chip.side === "left" ? "left" : "right"]: 0,
            width: "42%",
            borderRadius: chip.side === "left" ? "0 220px 220px 0" : "220px 0 0 220px",
            background: "rgba(255,255,255,.14)",
            animation: "gpFade .15s both",
          }}
        >
          {chip.side === "left" ? <ChevronsLeft size={28} /> : <ChevronsRight size={28} />}
          <span style={{ font: "700 12px/1 'DM Sans',sans-serif" }}>{chip.n * 10} seconds</span>
        </div>
      )}

      {/* brightness / volume HUD */}
      {hud && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex h-[38px] -translate-x-1/2 items-center gap-2.5 rounded-full px-3.5 text-white" style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(10px)", animation: "gpFade .2s both" }}>
          {hud === "b" ? <Sun size={18} /> : hv === 0 ? <VolumeX size={18} /> : hv < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
          <div style={{ width: 110, height: 4, borderRadius: 999, background: "rgba(255,255,255,.25)" }}>
            <div style={{ height: "100%", width: `${Math.round(hv * 100)}%`, borderRadius: 999, background: "#fff" }} />
          </div>
          <span style={{ width: 32, textAlign: "right", font: "600 12px/1 'DM Sans',sans-serif" }}>{Math.round(hv * 100)}</span>
        </div>
      )}

      {/* buffering */}
      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center bg-black/40">
          <Loader2 className="h-10 w-10 animate-spin text-[#EF4130]" />
        </div>
      )}

      {!error && (
        <PlayerControls
          visible={controlsShown}
          playing={playing}
          current={current}
          duration={duration}
          buffered={buffered}
          title={title}
          subtitle={subtitle}
          isFs={isFs}
          muted={muted}
          onBack={() => (isFs ? exitPlayerFs() : onBack())}
          onTogglePlay={() => (togglePlay(), poke())}
          onSeekBy={(d) => (seekBy(d), poke())}
          onSeekTo={(t) => (seekTo(t), poke())}
          onSettings={() => setSettingsOpen(true)}
          onFullscreen={toggleFs}
          onMute={toggleMute}
          onScrub={poke}
        />
      )}

      {/* started muted (browser autoplay rule) → one tap for sound */}
      {muted && !error && playing && (
        <button
          type="button"
          data-ng="1"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const v = videoRef.current;
            if (v) {
              v.muted = false;
              if (v.volume === 0) v.volume = 1;
            }
          }}
          className="absolute left-3 top-3 z-30 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white"
          style={{ background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.3)", backdropFilter: "blur(8px)", marginTop: isFs ? "env(safe-area-inset-top)" : 0, animation: "gpFade .3s both" }}
        >
          <VolumeX size={14} /> Tap for sound
        </button>
      )}

      {/* Skip intro */}
      {showSkip && !error && (
        <button
          type="button"
          data-ng="1"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            seekTo(skipIntro!.end);
          }}
          className="absolute right-3 z-30 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white"
          style={{ bottom: controlsShown ? 46 : 14, border: "1px solid rgba(255,255,255,.3)", background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", transition: "bottom .3s", animation: "gpFade .3s both" }}
        >
          <SkipForward size={14} /> Skip intro
        </button>
      )}

      {/* Up next (last 15 s): countdown, Play now, ✕ */}
      {showNext && !error && (
        <div
          data-ng="1"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute z-30 text-white"
          style={{ right: 10, bottom: controlsShown ? (isFs ? 96 : 70) : isFs ? 24 : 42, transition: "bottom .3s", width: 156, padding: 8, borderRadius: 12, background: "rgba(0,0,0,.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.12)", animation: "gpRise .35s both", fontFamily: "'DM Sans',sans-serif" }}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span style={{ font: "600 11px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.75)" }}>Up next in {Math.ceil(remaining)}s</span>
            <button type="button" aria-label="Cancel autoplay" onClick={() => setNextCancelled(true)} className="-my-1 -mr-1 flex h-[26px] w-[26px] items-center justify-center rounded-full" style={{ color: "rgba(245,245,245,.8)" }}>
              <X size={15} />
            </button>
          </div>
          <p className="truncate" style={{ margin: "4px 0 0", font: "700 13px/1.2 'DM Sans',sans-serif" }}>{next!.title}</p>
          <button
            type="button"
            onClick={() => {
              save();
              next!.onPlay();
            }}
            className="mt-2 flex h-[34px] w-full items-center justify-center gap-1.5 rounded-[10px]"
            style={{ background: "#F5F5F5", color: "#000", font: "700 12px/1 'DM Sans',sans-serif" }}
          >
            <Play size={13} fill="currentColor" /> Play now
          </button>
          <div style={{ marginTop: 8, height: 3, borderRadius: 999, background: "rgba(255,255,255,.18)" }}>
            <div style={{ height: "100%", width: `${Math.min(100, ((15 - remaining) / 15) * 100)}%`, borderRadius: 999, background: "#EF4130", transition: "width 1s linear" }} />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center" style={{ fontFamily: "'DM Sans',sans-serif" }}>
          <p style={{ margin: 0, font: "700 16px/1.25 Outfit,sans-serif", color: "#fff" }}>Video can't play right now</p>
          <p className="max-w-[340px]" style={{ margin: 0, font: "500 13px/1.45 'DM Sans',sans-serif", color: "rgba(245,245,245,.82)" }}>
            {checking ? "Checking what went wrong…" : reason ? <><span style={{ color: "#FF8A7D", fontWeight: 700 }}>Reason: </span>{reason}</> : error}
          </p>
          {errorDetail && /[?&]debug=1/.test(window.location.search) && <p className="max-w-[90%] break-all text-[10px] text-white/35">{errorDetail}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold">
              Back
            </button>
            <button type="button" onClick={retry} className="rounded-full px-5 py-2 text-sm font-semibold" style={{ background: "#EF4130" }}>
              Retry
            </button>
          </div>
        </div>
      )}

      <SettingsSheet open={settingsOpen} onClose={closeSettings} levels={levels} level={level} onLevel={setLevel} speed={speed} onSpeed={changeSpeed} />
    </div>
  );
}
