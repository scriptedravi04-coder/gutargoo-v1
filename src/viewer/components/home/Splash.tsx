import { useEffect, useRef, useState } from "react";
import { markSplashDone, shouldShowSplash } from "./splashState";
import { storage } from "@v/lib/storage";
import Welcome from "./Welcome";

const MAX_MS = 5000;
const HANDOFF_DELAY_MS = 300;
const FADE_MS = 500;

// Same as the app's splash (app/lib/splash/splash_screen.dart):
//  • very first open on this device → "Watch On Any Device Free" screen, swipe "Home >>>" to enter
//  • after that → black screen playing the logo animation, once per visit (and every time the installed app opens)
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "fading" | "gone">(() => (shouldShowSplash() ? "show" : "gone"));
  // v3: no swipe-to-enter welcome screen any more — the logo animation, then straight in
  const [mode] = useState<"welcome" | "logo">(() => (storage.setOnboarded(), "logo"));
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishing = useRef(false);
  const timers = useRef<number[]>([]);

  const finish = (delay = HANDOFF_DELAY_MS) => {
    if (finishing.current) return;
    finishing.current = true;
    timers.current.push(
      window.setTimeout(() => {
        setPhase("fading");
        markSplashDone();
        timers.current.push(window.setTimeout(() => setPhase("gone"), FADE_MS));
      }, delay)
    );
  };

  useEffect(() => {
    if (phase === "gone" || mode === "welcome") return;
    timers.current.push(window.setTimeout(() => finish(0), MAX_MS));
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => finish(0));
    }
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;

  if (mode === "welcome")
    return (
      <div
        className="fixed inset-0 z-[100] bg-black transition-opacity ease-out"
        style={{ opacity: phase === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: phase === "fading" ? "none" : "auto" }}
      >
        <Welcome
          onDone={() => {
            storage.setOnboarded();
            finish();
          }}
        />
      </div>
    );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-5 transition-opacity ease-out"
      style={{ opacity: phase === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms`, pointerEvents: phase === "fading" ? "none" : "auto" }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src="/img/logo.mp4"
        muted
        autoPlay
        playsInline
        preload="auto"
        onEnded={() => finish()}
        onError={() => finish(0)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
