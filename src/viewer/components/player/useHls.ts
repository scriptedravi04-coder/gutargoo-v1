// Attaches an HLS (or plain MP4) stream to a <video>. Uses hls.js where the browser supports it,
// otherwise the browser's own HLS (Safari / iPhone). Cleans up on unmount or when the source changes.
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export interface QualityLevel {
  index: number; // hls.js level index
  height: number;
}

interface Options {
  autoPlay?: boolean;
  /** called when the browser refuses to autoplay (usually because of sound) */
  onAutoplayBlocked?: (video: HTMLVideoElement) => void;
}

const looksHls = (src: string) => /\.m3u8($|\?|#)/i.test(src) || /\/playlist\b/i.test(src);

export function useHls(videoRef: RefObject<HTMLVideoElement>, src: string | null | undefined, options: Options = {}) {
  const hlsRef = useRef<Hls | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [level, setLevelState] = useState(-1); // -1 = Auto
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);
    setLevels([]);
    setLevelState(-1);

    const tryPlay = () => {
      if (!optsRef.current.autoPlay) return;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch((e: DOMException) => {
          if (e?.name === "NotAllowedError") optsRef.current.onAutoplayBlocked?.(video);
        });
      }
    };

    const nativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");
    const isHls = looksHls(src);

    // plain file, or browser plays HLS itself and hls.js can't run here
    // iPhone: prefer Safari's own HLS (hls.js there only runs on ManagedMediaSource)
    const hasMSE = typeof window !== "undefined" && !!(window as unknown as { MediaSource?: unknown }).MediaSource;
    if (!isHls || (nativeHls && (!Hls.isSupported() || !hasMSE))) {
      const onErr = () => setError("This video couldn't be played.");
      video.addEventListener("error", onErr);
      video.src = src;
      video.load();
      tryPlay();
      return () => {
        video.removeEventListener("error", onErr);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setError("Your browser can't play this video. Please try Chrome or Safari.");
      return;
    }

    const hls = new Hls({ enableWorker: true, capLevelToPlayerSize: true });
    hlsRef.current = hls;
    let destroyed = false;
    let networkRetried = false;
    let mediaRecovered = false;

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      const seen = new Set<number>();
      const list: QualityLevel[] = [];
      (data.levels || []).forEach((l, index) => {
        if (l.height && !seen.has(l.height)) {
          seen.add(l.height);
          list.push({ index, height: l.height });
        }
      });
      list.sort((a, b) => b.height - a.height);
      setLevels(list);
      tryPlay();
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !networkRetried) {
        networkRetried = true;
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        hls.recoverMediaError();
      } else {
        setError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "Couldn't load the video. Check your internet and try again." : "This video couldn't be played.");
        destroyed = true;
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      }
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      if (!destroyed) hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [videoRef, src, attempt]);

  const setLevel = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index; // -1 = Auto
    setLevelState(index);
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { levels, level, setLevel, error, retry };
}
