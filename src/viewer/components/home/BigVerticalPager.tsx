import { useRef, useState } from "react";
import clsx from "clsx";
import type { Item } from "@v/lib/content";
import { ArrowButton } from "./HScroll";
import { PosterCard } from "./PosterCard";
import { useDragScroll } from "./useDragScroll";

// Full-width pager of tall posters with dots underneath (displayStyle big_vertical)
export function BigVerticalPager({ items }: { items: Item[] }) {
  const ref = useDragScroll<HTMLDivElement>({ snap: true });
  const [index, setIndex] = useState(0);
  const raf = useRef(0);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || !el.clientWidth) return;
      setIndex(Math.max(0, Math.min(items.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
    });
  };

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const t = (i + items.length) % items.length;
    el.scrollTo({ left: t * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div className="group relative">
        <div ref={ref} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {items.map((it) => (
            <div key={it.id} className="w-full shrink-0 snap-center px-[31px] py-2">
              <PosterCard item={it} image={it.bigVertical || it.poster} className="h-[400px] w-full rounded-lg" />
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <>
            <ArrowButton side="left" onClick={() => go(index - 1)} />
            <ArrowButton side="right" onClick={() => go(index + 1)} />
          </>
        )}
      </div>
      {items.length > 1 && (
        <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
          {items.map((it, i) => (
            <span key={it.id} className={clsx("h-1 rounded-full transition-all duration-300", i === index ? "w-6 bg-white/60" : "w-2 bg-white/40")} />
          ))}
        </div>
      )}
    </div>
  );
}
