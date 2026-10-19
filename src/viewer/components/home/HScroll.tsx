import { CSSProperties, ReactNode, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { useDragScroll } from "./useDragScroll";

// Horizontal row: native swipe on phones, drag + small arrow buttons on desktop.
export function HScroll({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useDragScroll<HTMLDivElement>();
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, [ref]);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <div ref={ref} onScroll={update} className={clsx("no-scrollbar flex overflow-x-auto overscroll-x-contain", className)} style={style}>
        {children}
      </div>
      {canLeft && <ArrowButton side="left" onClick={() => page(-1)} />}
      {canRight && <ArrowButton side="right" onClick={() => page(1)} />}
    </div>
  );
}

export function ArrowButton({ side, onClick, always = false }: { side: "left" | "right"; onClick: () => void; always?: boolean }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={clsx(
        "absolute top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur transition-opacity hover:bg-black/80 sm:flex",
        side === "left" ? "left-1.5" : "right-1.5",
        !always && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
