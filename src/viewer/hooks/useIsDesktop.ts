import { useSyncExternalStore } from "react";

// Laptop / desktop / TV → big-screen layout (top menu, wide rows).
// Phones keep the mobile-app layout — also when turned sideways (landscape phones are wide but short).
export const DESKTOP_QUERY = "(min-width: 768px) and (min-height: 500px)";

const mq = typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY) : null;
let last = !!mq?.matches;

// while a video/trailer is fullscreen (it may rotate the phone) keep the current layout,
// otherwise the player would be rebuilt and playback would restart
const videoFullscreen = () => {
  const fs = typeof document !== "undefined" ? document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement : null;
  return !!fs && fs !== document.documentElement;
};

const snapshot = () => {
  if (!mq) return false;
  if (!videoFullscreen()) last = mq.matches;
  return last;
};

const subscribe = (cb: () => void) => {
  if (!mq) return () => {};
  mq.addEventListener("change", cb);
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    mq.removeEventListener("change", cb);
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
};

export const isDesktopNow = snapshot;

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
