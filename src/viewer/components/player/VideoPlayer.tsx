// The full player (app's video_screen): HLS video, auto-hiding controls, double-tap seek,
// settings, fullscreen, Skip Intro, Next episode, keyboard shortcuts and progress callbacks.
// One instance can play several sources in a row (next episode): when `src` changes it saves the
// old one, resets and loads the new one — so fullscreen stays on between episodes.
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import clsx from "clsx";
import { Loader2, SkipForward } from "lucide-react";
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
const SAVE_EVERY = 15000;

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
  const [chip, setChip] = useState<{ side: "left" | "right"; key: number } | null>(null);

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
    return () => save(); // still the old source here
  }, [src, mediaId, save]);

  const { levels, level, setLevel, error, errorDetail, retry: reload, source } = useHls(videoRef, src, {
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

  /* ── taps: single = controls (touch) / play-pause (mouse); double = ±10 s ── */
  const lastTap = useRef(0);
  const tapTimer = useRef<number>();
  const onSurfaceTap = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const side: "left" | "right" = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const isMouse = e.pointerType === "mouse";
    if (now - lastTap.current < 300) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = 0;
      seekBy(side === "left" ? -10 : 10);
      setChip({ side, key: now });
      poke();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => {
      if (isMouse) {
        togglePlay();
        poke();
      } else if (visible) setVisible(false);
      else poke();
    }, 300);
  };
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  useEffect(() => {
    if (!chip) return;
    const id = window.setTimeout(() => setChip(null), 700);
    return () => window.clearTimeout(id);
  }, [chip]);

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
        setChip({ side: "left", key: Date.now() });
      } else if (k === "arrowright") {
        e.preventDefault();
        seekBy(10);
        setChip({ side: "right", key: Date.now() });
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
  }, [togglePlay, seekBy, toggleFs, toggleMute, poke]);

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
    if (next) next.onPlay();
  };

  const remaining = duration - current;
  const showSkip = !!skipIntro && current >= skipIntro.start && current < skipIntro.end;
  const showNext = !!next && duration > 0 && remaining <= 120;
  // Skip Intro / Next sit just above the seek bar while the controls show (clear of the ±10 s buttons)
  const pillBottom = visible || !playing ? "bottom-[3.75rem] desk:bottom-[4.5rem]" : "bottom-3 desk:bottom-5";

  return (
    <div
      ref={containerRef}
      data-player
      data-tv-start
      tabIndex={0}
      aria-label={title ? `Video player: ${title}` : "Video player"}
      onFocus={poke}
      className={clsx("relative w-full select-none overflow-hidden bg-black", isFs ? "h-full" : "aspect-video", !visible && playing && "cursor-none")}
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

      {/* tap surface */}
      <div className="absolute inset-0 z-10" onPointerUp={onSurfaceTap} />

      {/* double-tap chip */}
      {chip && (
        <div
          key={chip.key}
          className={clsx("pointer-events-none absolute inset-y-0 z-30 flex items-center", chip.side === "left" ? "left-[12%]" : "right-[12%]")}
        >
          <span className="animate-pop rounded-[10px] bg-black/55 px-3 py-1.5 text-xs font-semibold">{chip.side === "left" ? "« 10 sec" : "10 sec »"}</span>
        </div>
      )}

      {/* buffering */}
      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center bg-black/40">
          <Loader2 className="h-10 w-10 animate-spin text-[#E50914]" />
        </div>
      )}

      {!error && (
        <PlayerControls
          visible={visible}
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

      {/* Skip Intro (bottom-right) */}
      {showSkip && !error && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            seekTo(skipIntro!.end);
          }}
          className={clsx(
            "absolute right-3 z-30 flex items-center gap-1 rounded-[30px] bg-gradient-to-r from-[#C1BDBD] to-[#ECEAEA] px-3 py-1.5 text-[10px] font-semibold text-black shadow transition-[bottom] duration-300 desk:right-5",
            pillBottom
          )}
        >
          <SkipForward className="h-[15px] w-[15px]" fill="currentColor" /> Skip Intro
        </button>
      )}

      {/* Next episode (bottom-left) */}
      {showNext && !error && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            save();
            next!.onPlay();
          }}
          className={clsx(
            "absolute left-3 z-30 flex items-center gap-1 rounded-[30px] bg-gradient-to-r from-[#C1BDBD] to-[#ECEAEA] px-3 py-1.5 text-xs font-semibold text-black shadow transition-[bottom] duration-300 desk:left-5",
            showSkip ? "max-w-[calc(100%-9rem)]" : "max-w-[60%]",
            pillBottom
          )}
        >
          <SkipForward className="h-[15px] w-[15px] shrink-0" fill="currentColor" />
          <span className="truncate">Next: {next!.title}</span>
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
          <p className="text-sm text-white/80">{error}</p>
          {errorDetail && <p className="max-w-[90%] break-all text-[10px] text-white/35">{errorDetail}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold">
              Back
            </button>
            <button type="button" onClick={retry} className="rounded-lg bg-[#E50914] px-5 py-2 text-sm font-semibold">
              Retry
            </button>
          </div>
        </div>
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={closeSettings}
        levels={levels}
        level={level}
        onLevel={setLevel}
        speed={speed}
        onSpeed={changeSpeed}
      />
    </div>
  );
}
