// Top of the details screen: the trailer plays muted (16:9). Tap shows a play/pause button for 3 s.
// No trailer (or it fails) → the banner with a play icon that starts the title.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Img } from "@v/components/Img";
import { storage } from "@v/lib/storage";
import { useHls } from "@v/components/player/useHls";
import { enterFullscreen, fullscreenElement, onFullscreenChange, unlockOrientation } from "@v/components/player/fullscreen";
import type { Item } from "@v/lib/content";
import { useGoBack } from "@v/hooks/useGoBack";

export interface TrailerHeroHandle {
  /** fullscreen trailer with sound (the "Trailer" pill) */
  openFullscreen: () => void;
}

interface Props {
  item: Item;
  onPlay: () => void;
  /** tells the page whether the trailer can actually play (hides the Trailer pill when it can't) */
  onAvailable?: (ok: boolean) => void;
}

export const TrailerHero = forwardRef<TrailerHeroHandle, Props>(function TrailerHero({ item, onPlay, onAvailable }, ref) {
  const goBack = useGoBack();
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(storage.getMuted());
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showCtl, setShowCtl] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const timer = useRef<number>();

  const src = item.trailerUrl;
  const { error } = useHls(videoRef, src, {
    autoPlay: true,
    // sound was left on last time but the browser blocks autoplay with sound → play muted
    onAutoplayBlocked: (v) => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    },
  });
  const hasTrailer = !!src && !error;
  useEffect(() => onAvailable?.(hasTrailer), [hasTrailer, onAvailable]);

  // React doesn't keep the `muted` attribute in sync, so set the property directly
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, hasTrailer]);

  useEffect(() => setReady(false), [src]);

  const flashControls = useCallback(() => {
    setShowCtl(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShowCtl(false), 3000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(
    () =>
      onFullscreenChange(() => {
        const fs = !!boxRef.current && fullscreenElement() === boxRef.current;
        setIsFs(fs);
        if (!fs) unlockOrientation();
      }),
    []
  );

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    flashControls();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    storage.setMuted(next);
  };

  useImperativeHandle(
    ref,
    () => ({
      openFullscreen: () => {
        const v = videoRef.current;
        if (!v || !hasTrailer) return;
        v.muted = false;
        setMuted(false);
        v.play().catch(() => {});
        enterFullscreen(boxRef.current, v);
      },
    }),
    [hasTrailer]
  );

  if (!hasTrailer) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <Img src={item.banner} alt={item.title} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
        <button type="button" onClick={onPlay} aria-label={`Play ${item.title}`} className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-[18px] ring-1 ring-white/20">
            <Play className="ml-1 h-9 w-9" fill="currentColor" />
          </span>
        </button>
        {src && error && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/55">Trailer unavailable</span>
        )}
        <BackButton onClick={goBack} />
      </div>
    );
  }

  return (
    <div
      ref={boxRef}
      className={isFs ? "relative h-full w-full bg-black" : "relative aspect-video w-full overflow-hidden bg-black"}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        preload="auto"
        poster={item.banner || undefined}
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onCanPlay={() => setReady(true)}
        onPlaying={() => (setReady(true), setPlaying(true))}
        onPause={() => setPlaying(false)}
        onClick={flashControls}
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}
      {showCtl && ready && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause trailer" : "Play trailer"}
          className="animate-pop absolute left-1/2 top-1/2 -ml-9 -mt-9 rounded-full bg-black/55 p-[18px]"
        >
          {playing ? <Pause className="h-9 w-9" fill="currentColor" /> : <Play className="h-9 w-9" fill="currentColor" />}
        </button>
      )}
      {!isFs && <BackButton onClick={goBack} />}
      <span className="pointer-events-none absolute right-3 top-3 text-xs font-extrabold text-white/60">Trailer</span>
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute trailer" : "Mute trailer"}
        className="absolute bottom-3 right-3 rounded-full bg-black/55 p-2"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  );
});

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Back" className="absolute left-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 hover:bg-black/50">
      <ArrowLeft className="h-6 w-6" />
    </button>
  );
}
