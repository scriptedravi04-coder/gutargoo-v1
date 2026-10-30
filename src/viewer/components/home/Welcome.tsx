import { useEffect, useRef, useState } from "react";
import { PromoCarousel } from "@v/components/profile/PromoCarousel";
import { isDesktopNow } from "@v/hooks/useIsDesktop";

// Same images as the app's first-open screen (app/lib/splash/splash_screen.dart)
const IMAGES = [
  "/img/promo_img3.jpg",
  "/img/promo_the_networker.jpg",
  "/img/promo_img4.jpg",
  "/img/promo_awasaan_trailer.jpg",
  "/img/promo_red_trailer.jpg",
];
const KNOB = 50; // px
const PAD = 6; // px gap around the knob
const UNLOCK_AT = 0.88;

// First time ever on this device: the app's "Watch On Any Device Free" screen with the "Home >>>" swipe.
export default function Welcome({ onDone }: { onDone: () => void }) {
  const [dot, setDot] = useState(0);
  const [value, setValue] = useState(0); // 0..1 slider position
  const [dragging, setDragging] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startValue: number; moved: boolean } | null>(null);
  const doneRef = useRef(false);

  const range = () => Math.max(1, (trackRef.current?.clientWidth || 300) - KNOB - PAD * 2);

  const unlock = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setValue(1);
    setUnlocking(true);
    onDone();
  };

  // no page scrolling behind this screen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to Gutargoo+" className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ background: "linear-gradient(to bottom, #0D1B14 0%, #0D1B14 50%, #000 100%)" }}>
      <div className="safe-bottom mx-auto flex min-h-full max-w-app flex-col" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 20px)" }}>
        <div className="animate-[gpFadeIn_1s_ease-in_both]">
          <PromoCarousel images={IMAGES} height="min(440px, 52vh)" rotate={0.18} onChange={setDot} />
        </div>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {IMAGES.map((_, i) => (
            <span key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: dot === i ? 24 : 6, background: dot === i ? "#fff" : "rgba(255,255,255,.3)" }} />
          ))}
        </div>

        <div className="mt-7 animate-[gpFadeIn_1s_ease-in_both] px-8 text-center">
          <h1 className="text-[28px] font-bold leading-tight">
            Watch On
            <br />
            Any Device Free
          </h1>
          <p className="mt-2.5 text-[13px] text-white/55">Discover unlimited entertainments</p>
        </div>

        <div className="flex-1" />

        {/* swipe "Home >>>" to enter */}
        <div className="px-8 pb-10">
          <div
            ref={trackRef}
            className="relative h-[62px] overflow-hidden rounded-full border border-white/[.12] bg-white/[.07]"
            onClick={(e) => {
              if (e.target === e.currentTarget) unlock();
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: KNOB + PAD * 2 + value * range(),
                background: "rgba(155,8,8,.25)",
                transition: dragging ? "none" : "width .3s ease",
              }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2">
              <span className="text-base font-semibold">Home</span>
              <span className="animate-pulse text-base tracking-[3px] text-white/60">&gt;&gt;&gt;</span>
            </div>
            <button
              type="button"
              aria-label="Swipe to enter"
              data-tv-start
              autoFocus={isDesktopNow()} // TV / keyboard: OK unlocks straight away (phones: no focus ring)
              className="absolute flex touch-none select-none items-center justify-center rounded-full"
              style={{
                top: PAD,
                left: PAD,
                width: KNOB - 1,
                height: KNOB,
                transform: `translateX(${value * range()}px)`,
                transition: dragging ? "none" : "transform .3s ease",
              }}
              onPointerDown={(e) => {
                if (doneRef.current) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { startX: e.clientX, startValue: value, moved: false };
                setDragging(true);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || doneRef.current) return;
                const dx = e.clientX - d.startX;
                if (Math.abs(dx) > 4) d.moved = true;
                const v = Math.min(1, Math.max(0, d.startValue + dx / range()));
                setValue(v);
                if (v >= UNLOCK_AT) {
                  drag.current = null;
                  setDragging(false);
                  unlock();
                }
              }}
              onPointerUp={() => {
                const d = drag.current;
                drag.current = null;
                setDragging(false);
                if (doneRef.current) return;
                if (d && !d.moved) unlock(); // a simple tap also works (mouse / accessibility)
                else setValue(0);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setDragging(false);
                if (!doneRef.current) setValue(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "NumpadEnter" || e.key === "Select" || e.key === " " || e.key === "ArrowRight") {
                  e.preventDefault();
                  unlock();
                }
              }}
            >
              {unlocking ? (
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <img src="/img/mark.png" alt="" className="h-full w-full object-contain" draggable={false} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
