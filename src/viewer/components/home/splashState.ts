// Shared "is the splash finished?" flag, so Home can wait before showing its popup.
import { useEffect, useState } from "react";

const SEEN_KEY = "gp-splash-seen";
let decided: boolean | null = null; // should the splash play in this page load?
let done = false;
const listeners = new Set<() => void>();

/** Decided once per page load: play only on the first visit of the session, and only when entering on "/". */
export function shouldShowSplash(): boolean {
  if (decided !== null) return decided;
  let seen = false;
  try {
    seen = sessionStorage.getItem(SEEN_KEY) === "1";
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // storage blocked: just play it
  }
  decided = !seen && window.location.pathname === "/";
  if (!decided) done = true;
  return decided;
}

export function markSplashDone() {
  if (done) return;
  done = true;
  listeners.forEach((fn) => fn());
}

export function useSplashDone(): boolean {
  const [isDone, setDone] = useState(() => (shouldShowSplash(), done));
  useEffect(() => {
    if (done) {
      setDone(true);
      return;
    }
    const fn = () => setDone(true);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return isDone;
}
