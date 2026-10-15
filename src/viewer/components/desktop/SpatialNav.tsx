// TV remote / keyboard support for big screens:
//   ← ↑ → ↓  move between cards and buttons (like a TV app)
//   OK/Enter opens, Back/Backspace goes back (or closes a popup)
// On the player page ← → stay "seek 10s" for the video.
import { useEffect } from "react";
import { useGoBack } from "@v/hooks/useGoBack";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
type Dir = "up" | "down" | "left" | "right";
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range" && (el as HTMLInputElement).type !== "checkbox") || (el as HTMLElement).isContentEditable);

function scope(): ParentNode {
  // a fullscreen video: only its own controls
  const fs = document.fullscreenElement;
  if (fs && fs !== document.documentElement) return fs;
  const dialogs = document.querySelectorAll('[aria-modal="true"]');
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

function usable(el: HTMLElement) {
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none" && st.pointerEvents !== "none";
}

function inViewport(r: DOMRect) {
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/** at least half of the smaller box shares the same height band */
const sameRow = (a: DOMRect, b: DOMRect) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >= Math.min(a.height, b.height) * 0.5;

function next(from: HTMLElement, dir: Dir): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of Array.from(scope().querySelectorAll<HTMLElement>(FOCUSABLE))) {
    if (el === from || from.contains(el) || el.contains(from) || el.getAttribute("tabindex") === "-1" || !usable(el)) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let primary: number;
    let ortho: number;
    if (dir === "right") {
      if (b.left < a.right - 2 && bx <= ax + 2) continue;
      primary = Math.max(0, b.left - a.right);
      ortho = Math.abs(by - ay);
      if (!sameRow(a, b)) continue; // stay in the same row
    } else if (dir === "left") {
      if (b.right > a.left + 2 && bx >= ax - 2) continue;
      primary = Math.max(0, a.left - b.right);
      ortho = Math.abs(by - ay);
      if (!sameRow(a, b)) continue;
    } else if (dir === "down") {
      if (b.top < a.bottom - 2 && by <= ay + 2) continue;
      primary = Math.max(0, b.top - a.bottom);
      ortho = Math.abs(bx - ax);
      if (!inViewport(b) && b.left >= window.innerWidth) ortho += 4000; // scrolled-away card in a row
    } else {
      if (b.bottom > a.top + 2 && by >= ay - 2) continue;
      primary = Math.max(0, a.top - b.bottom);
      ortho = Math.abs(bx - ax);
      if (!inViewport(b) && b.left >= window.innerWidth) ortho += 4000;
    }
    let score = primary + ortho * (dir === "left" || dir === "right" ? 2 : 0.6);
    // the fixed top menu is always "above"; only go there after the page content above is used up
    if (dir === "up" && !from.closest("header") && el.closest("header")) score += 5000;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

function firstOnScreen(): HTMLElement | null {
  const root = scope();
  const pref = root.querySelector<HTMLElement>("[data-tv-start]");
  if (pref && usable(pref)) return pref;
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getAttribute("tabindex") !== "-1" && usable(el) && inViewport(el.getBoundingClientRect())
  );
  // skip the top menu if the page has something else on screen
  return all.find((el) => !el.closest("header")) || all[0] || null;
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

export function SpatialNav() {
  const goBack = useGoBack();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      const onBody = !active || active === document.body;

      // Back key on remotes / Backspace on keyboards
      if (e.key === "Backspace" || e.key === "GoBack" || e.key === "BrowserBack") {
        if (isTyping(active)) return;
        e.preventDefault();
        const fs = document.fullscreenElement;
        if (fs && fs !== document.documentElement) document.exitFullscreen().catch(() => {}); // video fullscreen → leave it
        else if (document.querySelector('[aria-modal="true"]')) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        else goBack(); // (whole-site "TV mode" fullscreen stays on)
        return;
      }

      const dir = KEYS[e.key];
      if (!dir) return;
      if (isTyping(active) && (dir === "left" || dir === "right")) return;

      // player page: ← → seek the video unless a card/button below the player is focused
      const player = document.querySelector("[data-player]");
      if (player && (dir === "left" || dir === "right") && (onBody || player.contains(active))) return;

      const root = scope();
      if (onBody || !usable(active!) || (root !== document && !(root as Element).contains(active))) {
        const first = firstOnScreen();
        if (first) {
          e.preventDefault();
          focusEl(first);
        }
        return;
      }
      const target = next(active!, dir);
      if (target) {
        e.preventDefault();
        focusEl(target);
      } else if (dir === "up") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  return null;
}
