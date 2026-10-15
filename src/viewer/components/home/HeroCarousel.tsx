import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { Banner } from "@v/hooks/useCatalog";
import { detailPath } from "@v/lib/content";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { ArrowButton } from "./HScroll";
import { useDragScroll } from "./useDragScroll";

const HEIGHT = 450;
const GAP = 3;

// Big swipeable banners at the top of Home (no autoplay, no dots — same as the app).
export function HeroCarousel({ banners, onIndexChange }: { banners: Banner[]; onIndexChange: (i: number) => void }) {
  const ref = useDragScroll<HTMLDivElement>({ snap: true });
  const [index, setIndex] = useState(0);
  const raf = useRef(0);

  const stride = () => {
    const el = ref.current;
    if (!el || el.children.length < 2) return el ? el.clientWidth * 0.96 + GAP : 1;
    const [a, b] = Array.from(el.children) as HTMLElement[];
    return b.offsetLeft - a.offsetLeft;
  };

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(banners.length - 1, Math.round(el.scrollLeft / stride())));
      setIndex((prev) => (prev === i ? prev : i));
    });
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => onIndexChange(index), [index, onIndexChange]);

  // new banner list (category changed) → back to the first slide
  const bannerKey = banners.map((b) => b.id).join(",");
  useEffect(() => {
    ref.current?.scrollTo({ left: 0 });
    setIndex(0);
  }, [bannerKey, ref]);

  const go = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el) return;
      const target = (i + banners.length) % banners.length;
      el.scrollTo({ left: target * stride(), behavior: "smooth" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banners.length]
  );

  if (!banners.length) return null;

  return (
    <div className="group relative">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[2%]"
        style={{ gap: GAP, height: HEIGHT }}
        aria-roledescription="carousel"
      >
        {banners.map((b, i) => (
          <HeroSlide key={b.id} banner={b} label={`${i + 1} of ${banners.length}`} />
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <ArrowButton side="left" onClick={() => go(index - 1)} />
          <ArrowButton side="right" onClick={() => go(index + 1)} />
        </>
      )}
    </div>
  );
}

function HeroSlide({ banner, label }: { banner: Banner; label: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const item = banner.item!;
  const to = detailPath(item);
  const info = [banner.lang, ...banner.genres.slice(0, 2)].filter(Boolean);
  const title = item.title || banner.title;

  return (
    <div className="relative h-full w-[96%] shrink-0 snap-center overflow-hidden rounded-lg" aria-roledescription="slide" aria-label={label}>
      <Img src={banner.image} alt={title} className="h-full w-full" />
      {banner.item && !banner.item.isFree && <LockBadge />}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.54),transparent_45%,rgba(0,0,0,.87))]" />
      <Link to={to} className="absolute inset-0" aria-label={title} draggable={false} />

      <div className="pointer-events-none absolute inset-x-5 bottom-5 flex flex-col items-center text-center">
        {banner.logo && !logoFailed ? (
          <img src={banner.logo} alt={title} onError={() => setLogoFailed(true)} className="h-10 w-[220px] object-contain" draggable={false} />
        ) : (
          <h2 className="line-clamp-2 text-lg font-bold">{title}</h2>
        )}
        {info.length > 0 && (
          <p className="mt-0.5 text-[11px] font-medium tracking-[.3px] text-white">
            {info.map((t, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1.5 text-xs text-white/55">•</span>}
                {t}
              </span>
            ))}
          </p>
        )}
        <Link
          to={to}
          draggable={false}
          className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-[18px] py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Watch Now
        </Link>
      </div>
    </div>
  );
}

export function HeroShimmer() {
  return (
    <div className="px-[2%]">
      <div className="shimmer h-[420px] rounded-xl" />
    </div>
  );
}
