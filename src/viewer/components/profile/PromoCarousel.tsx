import { useEffect, useRef, useState } from "react";

// Tilted, auto-advancing promo carousel (onboarding / login): centre card big, side cards smaller and rotated.
export function PromoCarousel({
  images,
  height = 380,
  rotate = 0.1,
  interval = 3000,
  onChange,
}: {
  images: string[];
  height?: number | string;
  rotate?: number;
  interval?: number;
  /** current card (0..images.length-1), for the dots under it */
  onChange?: (i: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = images.length;

  useEffect(() => {
    if (n < 2) return;
    const t = window.setInterval(() => setIndex((i) => i + 1), interval);
    return () => window.clearInterval(t);
  }, [n, interval, index]);

  useEffect(() => {
    if (n) onChange?.(((index % n) + n) % n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, n]);

  if (!n) return null;
  const mod = (p: number) => ((p % n) + n) % n;
  const positions = [index - 2, index - 1, index, index + 1, index + 2];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) setIndex((i) => i + (dx < 0 ? 1 : -1));
      }}
      aria-roledescription="carousel"
    >
      {positions.map((p) => {
        const d = p - index;
        const scale = Math.max(0.85, 1 - Math.abs(d) * 0.12);
        return (
          <div
            key={p}
            className="absolute top-0 h-full transition-[transform,opacity] duration-500 ease-out"
            style={{
              width: "72%",
              left: "14%",
              transform: `translateX(${d * 100}%) translateY(${Math.abs(d) * 20}px) rotate(${-d * rotate}rad) scale(${scale})`,
              opacity: Math.abs(d) > 1 ? 0 : 1,
              zIndex: 10 - Math.abs(d),
            }}
            aria-hidden={d !== 0}
          >
            <img src={images[mod(p)]} alt={d === 0 ? "Gutargoo+ originals" : ""} className="h-full w-full rounded-[20px] object-cover shadow-[0_10px_30px_rgba(0,0,0,.6)]" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}
