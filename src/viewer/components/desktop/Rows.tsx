// Big-screen rows and cards (Netflix / Hotstar style). All sizes in rem so TVs scale them up.
import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { detailPath, infoLine, Item } from "@v/lib/content";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";

/* ───────── row container with big edge arrows ───────── */

export function Scroller({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/row relative">
      <div ref={ref} onScroll={update} className={clsx("gp-row no-scrollbar flex gap-[0.65rem] overflow-x-auto scroll-smooth px-[4%]", className)} style={style}>
        {children}
      </div>
      {canLeft && <EdgeArrow side="left" onClick={() => page(-1)} />}
      {canRight && <EdgeArrow side="right" onClick={() => page(1)} />}
    </div>
  );
}

function EdgeArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={clsx(
        "absolute inset-y-3 z-20 flex w-[4%] min-w-[2.5rem] items-center justify-center opacity-0 transition-opacity hover:opacity-100 group-hover/row:opacity-100",
        side === "left" ? "left-0 bg-gradient-to-r from-black/90 to-transparent" : "right-0 bg-gradient-to-l from-black/90 to-transparent"
      )}
    >
      <Icon className="h-9 w-9 drop-shadow" />
    </button>
  );
}

/* ───────── row header ───────── */

export function RowHeader({ title, viewAllTo }: { title: string; viewAllTo?: string }) {
  return (
    <div className="flex items-end justify-between gap-4 px-[4%]">
      <h2 className="truncate text-[1.3rem] font-bold tracking-tight text-white">{title}</h2>
      {viewAllTo && (
        <Link to={viewAllTo} className="group shrink-0 rounded px-1 text-sm font-semibold text-orange hover:text-orange/80">
          View All <ChevronRight className="inline h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function DesktopRow({ title, viewAllTo, children }: { title: string; viewAllTo?: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <RowHeader title={title} viewAllTo={viewAllTo} />
      {children}
    </section>
  );
}

/* ───────── cards ───────── */

const metaOf = (it: Item) => [it.year ? String(it.year) : "", it.age, infoLine(it, 2)].filter(Boolean).join(" • ");

/** Portrait poster (2:3). size: "md" normal row, "lg" big originals row */
export function PosterTile({ item, size = "md", className }: { item: Item; size?: "md" | "lg"; className?: string }) {
  return (
    <Link
      to={detailPath(item)}
      draggable={false}
      aria-label={item.title}
      className={clsx(
        "gp-card group relative block shrink-0 overflow-hidden rounded-lg bg-[#1A1A1A]",
        size === "lg" ? "w-[14rem] lg:w-[16rem] xl:w-[17.5rem]" : "w-[10.5rem] lg:w-[12rem] xl:w-[13rem]",
        className
      )}
    >
      <Img src={size === "lg" ? item.bigVertical || item.poster : item.poster} alt={item.title} className="aspect-[2/3] w-full" />
      {!item.isFree && <LockBadge />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black via-black/70 to-transparent p-3 pt-10 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <p className="line-clamp-2 text-sm font-bold leading-tight">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-[0.7rem] text-white/70">{metaOf(item)}</p>
      </div>
    </Link>
  );
}

/** Landscape card (16:9) with the title under it */
export function LandscapeTile({ item, className }: { item: Item; className?: string }) {
  return (
    <Link
      to={detailPath(item)}
      draggable={false}
      aria-label={item.title}
      className={clsx("gp-card group relative block w-[17rem] shrink-0 rounded-lg lg:w-[19rem] xl:w-[21rem]", className)}
    >
      <div className="relative overflow-hidden rounded-lg">
        <Img src={item.banner} alt={item.title} className="aspect-video w-full" />
        {!item.isFree && <LockBadge />}
        <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Play className="h-4 w-4" fill="currentColor" />
        </span>
      </div>
      <p className="mt-2 truncate px-0.5 text-sm font-semibold">{item.title}</p>
      <p className="truncate px-0.5 text-xs text-white/50">{metaOf(item)}</p>
    </Link>
  );
}

/** Top-10: huge outlined rank number + poster */
export function Top10Tile({ item, rank }: { item: Item; rank: number }) {
  return (
    <Link
      to={detailPath(item)}
      draggable={false}
      aria-label={`${rank}. ${item.title}`}
      className="gp-card group relative flex shrink-0 items-end rounded-lg pl-[5.2rem] lg:pl-[6rem]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-0.6rem] left-0 select-none font-black leading-none text-black"
        style={{
          fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
          fontSize: "9.5rem",
          letterSpacing: "-0.5rem",
          WebkitTextStroke: "3px rgba(255,255,255,.9)",
          textShadow: "0 6px 30px rgba(0,0,0,.6)",
        }}
      >
        {rank}
      </span>
      <div className="relative w-[9.5rem] overflow-hidden rounded-lg lg:w-[10.5rem]">
        <Img src={item.poster} alt={item.title} className="aspect-[2/3] w-full" />
        {!item.isFree && <LockBadge />}
      </div>
    </Link>
  );
}

/** Responsive poster grid (View All, My List, search, More Like This) */
export function PosterGrid({ items, render }: { items: Item[]; render?: (it: Item) => ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {items.map((it) =>
        render ? (
          render(it)
        ) : (
          <Link key={it.id} to={detailPath(it)} aria-label={it.title} className="gp-card group block rounded-lg">
            <div className="relative overflow-hidden rounded-lg">
              <Img src={it.poster} alt={it.title} className="aspect-[2/3] w-full" />
              {!it.isFree && <LockBadge />}
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-white/90">{it.title}</p>
            <p className="truncate text-xs text-white/45">{metaOf(it)}</p>
          </Link>
        )
      )}
    </div>
  );
}

export function GridShimmer({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="shimmer aspect-[2/3] rounded-lg" />
          <div className="shimmer mt-2 h-3 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

export function RowShimmer() {
  return (
    <div className="mb-8">
      <div className="mx-[4%] mb-3 h-5 w-48 rounded shimmer" />
      <div className="flex gap-[0.65rem] overflow-hidden px-[4%]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer aspect-[2/3] w-[12rem] shrink-0 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
