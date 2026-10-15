// Big-screen hero: full-width banner that changes every 8 s (pauses on hover / remote focus).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, CircleCheck, Info, Play, Plus } from "lucide-react";
import type { Banner } from "@v/hooks/useCatalog";
import { detailPath, Item } from "@v/lib/content";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useToast } from "@v/hooks/useToast";

const INTERVAL = 8000;

export const durationText = (min?: number) => {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

/** Play straight away when possible, otherwise open the details page */
export function playPath(it: Item) {
  if (!it.isFree || !it.playUrl) return detailPath(it);
  return it.kind === "movie" ? `/watch/movie/${it.id}` : `/watch/series/${it.id}`;
}

export function MetaLine({ item, className }: { item: Item; className?: string }) {
  const seasons = item.kind !== "movie" && item.seasons.length ? `${item.seasons.length} Season${item.seasons.length > 1 ? "s" : ""}` : "";
  const parts = [item.year ? String(item.year) : "", durationText(item.durationMin), seasons, item.lang, ...item.genres.slice(0, 3)].filter(Boolean);
  return (
    <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] text-white/85", className)}>
      {item.imdb > 0 && <span className="rounded bg-imdb px-1.5 py-0.5 text-xs font-extrabold text-black">IMDb {item.imdb.toFixed(1)}</span>}
      {item.age && <span className="rounded border border-white/40 px-1.5 py-px text-xs font-semibold">{item.age}</span>}
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="h-1 w-1 rounded-full bg-white/50" aria-hidden="true" />}
          {p}
        </span>
      ))}
    </div>
  );
}

export function DesktopHero({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();
  const { has, toggle } = useWatchlist();
  const toast = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const n = banners.length;

  const key = banners.map((b) => b.id).join(",");
  useEffect(() => setIndex(0), [key]);

  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % n), INTERVAL);
    return () => window.clearTimeout(t);
  }, [index, paused, n]);

  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  if (!n) return null;
  const b = banners[Math.min(index, n - 1)];
  const item = b.item!;
  const title = item.title || b.title;
  const inList = has(item.id);

  return (
    <section
      ref={boxRef}
      className="relative h-[min(90vh,56.25vw)] min-h-[32rem] w-full overflow-hidden bg-black"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !boxRef.current?.contains(e.relatedTarget as Node) && setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured"
    >
      {banners.map((bn, i) => (
        <img
          key={bn.id}
          src={bn.wide}
          alt=""
          aria-hidden="true"
          className={clsx("absolute inset-0 h-full w-full object-cover transition-opacity duration-1000", i === index ? "opacity-100" : "opacity-0")}
          draggable={false}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.9)_0%,rgba(0,0,0,.55)_35%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black via-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />

      <div key={b.id} className="animate-fade-in absolute bottom-[27%] left-[4%] w-[min(42rem,48%)]" aria-live="polite">
        {b.logo ? (
          <img src={b.logo} alt={title} className="mb-5 max-h-[8rem] max-w-[26rem] object-contain object-left drop-shadow-2xl" />
        ) : (
          <h1 className="mb-4 font-black leading-[1.02] tracking-tight drop-shadow-2xl" style={{ fontSize: "clamp(2.25rem, 4.2vw, 4rem)" }}>{title}</h1>
        )}
        <MetaLine item={item} />
        {item.description && <p className="mt-4 line-clamp-3 max-w-[38rem] text-[1.05rem] leading-relaxed text-white/80">{item.description}</p>}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-tv-start
            onClick={() => navigate(playPath(item))}
            className="flex items-center gap-2.5 rounded-lg bg-white px-8 py-3.5 text-lg font-bold text-black transition hover:bg-white/85"
          >
            <Play className="h-6 w-6" fill="currentColor" /> {item.isFree ? "Play" : "Watch in App"}
          </button>
          <Link to={detailPath(item)} className="flex items-center gap-2.5 rounded-lg bg-white/20 px-7 py-3.5 text-lg font-semibold backdrop-blur transition hover:bg-white/30">
            <Info className="h-6 w-6" /> More Info
          </Link>
          <button
            type="button"
            onClick={() => toast(toggle(item) ? "Added to My List" : "Removed from My List")}
            aria-label={inList ? "Remove from My List" : "Add to My List"}
            title={inList ? "Remove from My List" : "Add to My List"}
            className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full border-2 border-white/50 bg-black/30 transition hover:border-white"
          >
            {inList ? <CircleCheck className="h-6 w-6 text-orange" /> : <Plus className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => go(index - 1)}
            aria-label="Previous"
            className="absolute left-0 top-1/2 flex h-24 w-12 -translate-y-1/2 items-center justify-center text-white/60 hover:text-white"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => go(index + 1)}
            aria-label="Next"
            className="absolute right-0 top-1/2 flex h-24 w-12 -translate-y-1/2 items-center justify-center text-white/60 hover:text-white"
          >
            <ChevronRight className="h-10 w-10" />
          </button>
          <div className="absolute bottom-[27%] right-[4%] flex gap-2">
            {banners.map((bn, i) => (
              <button
                key={bn.id}
                type="button"
                tabIndex={-1}
                onClick={() => go(i)}
                aria-label={`Show ${bn.item?.title || bn.title}`}
                className={clsx("h-1.5 rounded-full transition-all", i === index ? "w-8 bg-orange" : "w-4 bg-white/40 hover:bg-white/70")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function DesktopHeroShimmer() {
  return <div className="shimmer h-[min(90vh,56.25vw)] min-h-[32rem] w-full" />;
}
