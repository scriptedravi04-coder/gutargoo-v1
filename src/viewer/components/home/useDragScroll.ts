// Lets mouse users drag horizontal rows (touch already scrolls natively).
// A drag never counts as a click, so links inside the row don't open by accident.
import { useEffect, useRef } from "react";

export function useDragScroll<T extends HTMLElement>({ snap = false }: { snap?: boolean } = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    let restoreTimer = 0;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        window.clearTimeout(restoreTimer);
        el.style.scrollSnapType = "none";
        el.style.scrollBehavior = "auto";
        el.style.cursor = "grabbing";
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "";
      if (!moved) return;
      if (snap) {
        // settle on the slide nearest to the centre, then turn snapping back on
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best: HTMLElement | null = null;
        let bestDist = Infinity;
        for (const c of Array.from(el.children) as HTMLElement[]) {
          const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (d < bestDist) (bestDist = d), (best = c);
        }
        if (best) el.scrollTo({ left: best.offsetLeft - (el.clientWidth - best.offsetWidth) / 2, behavior: "smooth" });
        restoreTimer = window.setTimeout(() => {
          el.style.scrollSnapType = "";
          el.style.scrollBehavior = "";
        }, 450);
      } else {
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      }
    };
    const click = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };
    const dragStart = (e: DragEvent) => e.preventDefault();

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    el.addEventListener("dragstart", dragStart);
    return () => {
      window.clearTimeout(restoreTimer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("dragstart", dragStart);
    };
  }, [snap]);

  return ref;
}
