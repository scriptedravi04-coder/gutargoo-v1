// Attaches an HLS (or plain MP4) stream to a <video>. Uses hls.js where the browser supports it,
// otherwise the browser's own HLS (Safari / iPhone). Cleans up on unmount or when the source changes.
import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { playableUrl } from "@v/lib/api";

export interface QualityLevel {
  index: number; // hls.js level index
  height: number;
}

interface Options {
  autoPlay?: boolean;
  /** called when the browser refuses to autoplay (usually because of sound) */
  onAutoplayBlocked?: (video: HTMLVideoElement) => void;
  /** called when play() was refused for any other reason (so a spinner doesn't stay up) */
  onPlayRejected?: () => void;
}

const MAX_NETWORK_RETRIES = 3;

const looksHls = (src: string) => /\.m3u8($|\?|#)/i.test(src) || /\/playlist\b/i.test(src);

/** marks a candidate that must be played by the browser itself (not hls.js) */
const NATIVE = "native|";

const nativeHlsBrowser = () => {
  try {
    const v = document.createElement("video");
    const hasMSE = !!(window as unknown as { MediaSource?: unknown }).MediaSource;
    return !!v.canPlayType("application/vnd.apple.mpegurl") && (!Hls.isSupported() || !hasMSE);
  } catch {
    return false;
  }
};

/**
 * Every way we can try to play one video, best first. If one fails the player quietly tries the next:
 *  - Safari / iPhone (plays HLS itself, no CORS needed): the original link first, then this site's /stream copy
 *  - Chrome / Android (hls.js needs CORS): this site's /stream copy first, then the original link
 *  - last: Bunny's MP4 file (play_720p / play_480p) — a plain <video> file works everywhere if "MP4 fallback" is on
 */
export function sourceCandidates(raw: string): string[] {
  const proxied = playableUrl(raw);
  const list = nativeHlsBrowser() ? [raw, proxied] : [proxied, raw];
  // Android Chrome can also play HLS by itself (no CORS needed) — one more try before the MP4 files
  if (!nativeHlsBrowser() && looksHls(raw)) {
    try {
      if (document.createElement("video").canPlayType("application/vnd.apple.mpegurl")) list.push(`${NATIVE}${raw}`);
    } catch {
      /* ignore */
    }
  }
  const m = raw.match(/^(.*\/[0-9a-f-]{20,})\/playlist\.m3u8(\?.*)?$/i);
  if (m) {
    const base = m[1];
    const pBase = proxied.match(/^(.*\/[0-9a-f-]{20,})\/playlist\.m3u8/i)?.[1];
    for (const q of ["720p", "480p", "360p"]) {
      list.push(`${base}/play_${q}.mp4`);
      if (pBase && pBase !== base) list.push(`${pBase}/play_${q}.mp4`);
    }
  }
  return Array.from(new Set(list.filter(Boolean)));
}

/** `reloadKey`: load the source again when this changes, even if the link is the same
 *  (two episodes that use the same video must each start fresh). */
export function useHls(videoRef: RefObject<HTMLVideoElement>, rawSrc: string | null | undefined, options: Options = {}, reloadKey?: string) {
  // all the ways to play this video (see sourceCandidates); `cand` = the one being tried now
  const [cand, setCand] = useState(0);
  const [candKey, setCandKey] = useState(`${rawSrc}|${reloadKey}`);
  if (candKey !== `${rawSrc}|${reloadKey}`) {
    // new video → start again with the best source (state reset during render, React-approved pattern)
    setCandKey(`${rawSrc}|${reloadKey}`);
    setCand(0);
  }
  const candidates = rawSrc ? sourceCandidates(rawSrc) : [];
  const picked = rawSrc ? candidates[Math.min(cand, candidates.length - 1)] : rawSrc;
  const forceNative = !!picked && picked.startsWith(NATIVE);
  const src = picked && forceNative ? picked.slice(NATIVE.length) : picked;
  const hasNext = cand < candidates.length - 1;
  const triedRef = useRef<string[]>([]);
  const hlsRef = useRef<Hls | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [level, setLevelState] = useState(-1); // -1 = Auto
  const [error, setErrorState] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setErrorState(null);
    setLevels([]);
    setLevelState(-1);
    let gone = false;
    const host = (() => {
      try {
        return new URL(src, window.location.href).host;
      } catch {
        return "";
      }
    })();
    // this source failed → try the next one, or show the error when none is left
    const setError = (msg: string, why = "") => {
      if (gone) return;
      gone = true;
      triedRef.current = [...triedRef.current, `${host}${why ? ` (${why})` : ""}`].slice(-6);
      if (hasNext) {
        setCand((c) => c + 1);
        return;
      }
      setErrorDetail(triedRef.current.join(" → "));
      setErrorState(msg);
    };
    // nothing loads at all within 25 s (no error either) → treat as failed
    const stallTimer = window.setTimeout(() => {
      if (video.readyState === 0) setError("This video couldn't be played.", "timeout");
    }, 25000);
    const clearStall = () => window.clearTimeout(stallTimer);
    video.addEventListener("loadedmetadata", clearStall, { once: true });

    const tryPlay = () => {
      if (!optsRef.current.autoPlay) return;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch((e: DOMException) => {
          if (e?.name === "NotAllowedError") optsRef.current.onAutoplayBlocked?.(video);
          else if (e?.name !== "AbortError") optsRef.current.onPlayRejected?.();
        });
      }
    };

    const nativeHls = !!video.canPlayType("application/vnd.apple.mpegurl");
    const isHls = looksHls(src);

    // plain file, or browser plays HLS itself and hls.js can't run here
    // iPhone: prefer Safari's own HLS (hls.js there only runs on ManagedMediaSource)
    const hasMSE = typeof window !== "undefined" && !!(window as unknown as { MediaSource?: unknown }).MediaSource;
    if (!isHls || forceNative || (nativeHls && (!Hls.isSupported() || !hasMSE))) {
      const onErr = () => setError("This video couldn't be played.", `code ${video.error?.code ?? "?"}`);
      video.addEventListener("error", onErr);
      video.src = src;
      video.load();
      tryPlay();
      return () => {
        gone = true;
        clearStall();
        video.removeEventListener("loadedmetadata", clearStall);
        video.removeEventListener("error", onErr);
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setError("Your browser can't play this video. Please try Chrome or Safari.", "no hls");
      return () => {
        gone = true;
        clearStall();
      };
    }

    const hls = new Hls({ enableWorker: true, capLevelToPlayerSize: true });
    hlsRef.current = hls;
    let destroyed = false;
    let networkRetries = 0;
    let retryTimer = 0;
    let mediaRecovered = false;

    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
      // one entry per height: the highest-bitrate stream of that height
      const best = new Map<number, { index: number; bitrate: number }>();
      (data.levels || []).forEach((l, index) => {
        if (!l.height) return;
        const cur = best.get(l.height);
        if (!cur || (l.bitrate || 0) > cur.bitrate) best.set(l.height, { index, bitrate: l.bitrate || 0 });
      });
      const list: QualityLevel[] = Array.from(best, ([height, v]) => ({ index: v.index, height }));
      list.sort((a, b) => b.height - a.height);
      setLevels(list);
      tryPlay();
    });

    // network is fine again → allow fresh retries for the next hiccup
    hls.on(Hls.Events.FRAG_LOADED, () => {
      networkRetries = 0;
      mediaRecovered = false;
    });

    const MANIFEST_ERRORS: string[] = [
      Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
      Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
      Hls.ErrorDetails.MANIFEST_PARSING_ERROR,
    ];

    const fail = (msg: string, why = "") => {
      setError(msg, why);
      destroyed = true;
      window.clearTimeout(retryTimer);
      hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // another source is waiting → don't spend long retrying this one when the playlist itself fails
        const manifestFail = MANIFEST_ERRORS.includes(data.details) || !hls.levels || hls.levels.length === 0;
        const limit = hasNext && manifestFail ? 1 : MAX_NETWORK_RETRIES;
        if (networkRetries >= limit) {
          const code = (data.response as { code?: number } | undefined)?.code;
          fail("Couldn't load the video. Check your internet and try again.", `${data.details}${code ? ` ${code}` : ""}`);
          return;
        }
        // the playlist itself failed (or nothing is known about the stream yet): startLoad() would do
        // nothing and leave an endless spinner → ask for the playlist again
        const reloadManifest = MANIFEST_ERRORS.includes(data.details) || !hls.levels || hls.levels.length === 0;
        const wait = 1000 * 2 ** networkRetries; // 1 s, 2 s, 4 s
        networkRetries++;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          if (destroyed) return;
          if (reloadManifest) hls.loadSource(src);
          else hls.startLoad();
        }, wait);
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
        mediaRecovered = true;
        hls.recoverMediaError();
      } else {
        fail("This video couldn't be played.", String(data.details || data.type));
      }
    });

    hls.loadSource(src);
    hls.attachMedia(video);

    return () => {
      gone = true;
      clearStall();
      video.removeEventListener("loadedmetadata", clearStall);
      window.clearTimeout(retryTimer);
      if (!destroyed) hls.destroy();
      destroyed = true;
      if (hlsRef.current === hls) hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, src, forceNative, attempt, reloadKey]);

  const setLevel = useCallback((index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index; // -1 = Auto
    setLevelState(index);
  }, []);

  // Retry → start again from the best source
  const retry = useCallback(() => {
    triedRef.current = [];
    setErrorDetail("");
    setCand(0);
    setAttempt((a) => a + 1);
  }, []);

  return { levels, level, setLevel, error, errorDetail, retry, source: picked };
}
