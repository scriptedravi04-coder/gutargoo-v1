// Fullscreen helpers that also work on Safari / iPhone (webkit-prefixed APIs).
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export const fullscreenElement = (): Element | null => {
  const d = document as WebkitDoc;
  return document.fullscreenElement || d.webkitFullscreenElement || null;
};

const lockLandscape = () => {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    o?.lock?.("landscape")?.catch(() => {});
  } catch {
    /* not supported */
  }
};

export const unlockOrientation = () => {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* not supported */
  }
};

/** Puts `container` in fullscreen (landscape where allowed). Falls back to the iPhone video player. */
export async function enterFullscreen(container: HTMLElement | null, video: HTMLVideoElement | null) {
  const el = container as WebkitEl | null;
  try {
    if (el?.requestFullscreen) {
      await el.requestFullscreen();
      lockLandscape();
      return;
    }
    if (el?.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      lockLandscape();
      return;
    }
  } catch {
    /* fall through to the video element */
  }
  const v = video as WebkitVideo | null;
  if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
}

export function exitFullscreen() {
  const d = document as WebkitDoc;
  try {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
  unlockOrientation();
}

/** Calls `cb` whenever fullscreen starts or ends. Returns an unsubscribe function. */
export function onFullscreenChange(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}
