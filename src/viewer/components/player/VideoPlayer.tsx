// The full player (app's video_screen): HLS video, auto-hiding controls, double-tap seek,
// settings, fullscreen, Skip Intro, Next episode, keyboard shortcuts and progress callbacks.
// Mount it with key={src} so a new title gets a fresh player.
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
  startAt?: number;
  skipIntro?: { start: number; end: number };
  next?: { title: string; onPlay: () => void } | null;
  onBack: () => void;
  /** called every 15 s while playing, on pause, on end and when the player closes */
  onSave?: (seconds: number, duration: number, completed: boolean) => void;
}

const HIDE_AFTER = 3000;
const SAVE_EVERY = 15000;

export function VideoPlayer({ src, title, subtitle, startAt = 0, skipIntro, next, onBack, onSave }: VideoPlayerProps) {
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

  const { levels, level, setLevel, error, retry } = useHls(videoRef, src, {
    autoPlay: true,
    // browsers block autoplay with sound unless the user just tapped — start muted instead
    onAutoplayBlocked: (v) => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    },
  });

  /* ── progress saving ── */
  const timeRef = useRef(0);
  const durRef = useRef(0);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const lastSavedRef = useRef(-1);
  const save = useCallback((completed = false) => {
    const t = timeRef.current;
    const d = durRef.current;
    if (!saveRef.current || t < 1) return;
    if (!completed && Math.floor(t) === lastSavedRef.current) return;
    lastSavedRef.current = Math.floor(t);
    saveRef.current(t, d, completed || (d > 0 && t >= d - 1));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => save(), SAVE_EVERY);
    return () => window.clearInterval(id);
  }, [playing, save]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
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

  const toggleFs = useCallback(() => {
    if (fullscreenElement()) exitFullscreen();
    else enterFullscreen(containerRef.current, videoRef.current);
  }, []);

  useEffect(
    () =>
      onFullscreenChange(() => {
        const fs = fullscreenElement() === containerRef.current;
        setIsFs(fs);
        if (!fs) unlockOrientation();
      }),
    []
  );

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
      // a card / button elsewhere on the page is selected → arrows belong to it, not to the video
      const elsewhere = !!t && t !== document.body && !containerRef.current?.contains(t);
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
  const startApplied = useRef(false);
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    durRef.current = d;
    v.playbackRate = speed;
    if (!startApplied.current) {
      startApplied.current = true;
      if (startAt > 5 && (!d || startAt < d - 10)) v.currentTime = startAt;
    }
  };
  // a resume point that arrives after loading (e.g. from the server): seek only if we're still in the first ~3 s
  const lateApplied = useRef(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !startApplied.current || lateApplied.current || startAt <= 5) return;
    lateApplied.current = true;
    if (v.currentTime > 3) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    if (!d || startAt < d - 10) v.currentTime = startAt;
  }, [startAt]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    timeRef.current = v.currentTime;
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
          save();
        }}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
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
          onBack={() => (isFs ? exitFullscreen() : onBack())}
          onTogglePlay={() => (togglePlay(), poke())}
          onSeekBy={(d) => (seekBy(d), poke())}
          onSeekTo={(t) => (seekTo(t), poke())}
          onSettings={() => setSettingsOpen(true)}
          onFullscreen={toggleFs}
          onMute={toggleMute}
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
          className="absolute bottom-16 right-5 z-30 flex items-center gap-1 rounded-[30px] bg-gradient-to-r from-[#C1BDBD] to-[#ECEAEA] px-3 py-1.5 text-[10px] font-semibold text-black shadow"
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
          className="absolute bottom-16 left-5 z-30 flex max-w-[60%] items-center gap-1 rounded-[30px] bg-gradient-to-r from-[#C1BDBD] to-[#ECEAEA] px-3 py-1.5 text-xs font-semibold text-black shadow"
        >
          <SkipForward className="h-[15px] w-[15px] shrink-0" fill="currentColor" />
          <span className="truncate">Next: {next!.title}</span>
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
          <p className="text-sm text-white/80">{error}</p>
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
        onClose={() => setSettingsOpen(false)}
        levels={levels}
        level={level}
        onLevel={setLevel}
        speed={speed}
        onSpeed={changeSpeed}
      />
    </div>
  );
}
