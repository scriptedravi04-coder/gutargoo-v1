// Shared v3 building blocks: shell (safe areas, ambient glow, bottom nav), toast with Undo,
// glass bottom sheet, poster cards, the "leave" transition before a title detail.
import { createContext, CSSProperties, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Bookmark, Crown, House, Search, User } from "lucide-react";
import { detailPath, Item, Kind } from "@v/lib/content";
import "./v3.css";

/* ───────── constants ───────── */
export const RED = "#EF4130";
export const GOLD = "#F5B841";
export const GOLD_INK = "#1a1200";
export const EASE = "cubic-bezier(.2,.8,.2,1)";
export const POP = "cubic-bezier(.3,1.5,.5,1)";
/** "46px status bar" of the prototype → real safe area + a little air */
export const TOP = (px: number) => `calc(var(--st) + ${Math.max(0, px - 46)}px)`;

export const kindLabel = (k: Kind) => (k === "movie" ? "Movie" : k === "webseries" ? "Web series" : "TV show");
export const kindGenre = (it: Item) => [kindLabel(it.kind), it.genres[0]].filter(Boolean).join(" · ");
export const seasonsText = (n: number) => `${n} season${n === 1 ? "" : "s"}`;
export const durText = (min?: number) => {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
export const leftText = (sec: number) => {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
};
export const isLocked = (it: Pick<Item, "isFree">) => !it.isFree;

/** element width that follows resizes and survives the element being replaced (callback ref) */
export function useWidth(initial = 390): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(initial);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const read = () => el.clientWidth > 0 && setW(el.clientWidth);
    read();
    ro.current = new ResizeObserver(read);
    ro.current.observe(el);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [ref, w];
}

/** the part of the screen the user can actually see (iPhone keyboard open → smaller and shifted).
 *  A screen pinned to it keeps the form above the keyboard instead of iOS sliding everything up. */
export function useVisibleBox(): { height: string; top: number } {
  const [box, setBox] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const on = () => setBox({ h: Math.round(v.height), top: Math.round(v.offsetTop) });
    on();
    v.addEventListener("resize", on);
    v.addEventListener("scroll", on);
    return () => {
      v.removeEventListener("resize", on);
      v.removeEventListener("scroll", on);
    };
  }, []);
  return box ? { height: `${box.h}px`, top: box.top } : { height: "100dvh", top: 0 };
}

/* ───────── toast (3.5 s, optional Undo) ───────── */
type ToastFn = (msg: string, undo?: () => void) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useV3Toast = () => useContext(ToastCtx);

export function V3ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; undo?: () => void; key: number } | null>(null);
  const [overNav, setOverNav] = useState(true);
  const timer = useRef<number>();
  const show = useCallback<ToastFn>((msg, undo) => {
    window.clearTimeout(timer.current);
    setOverNav(!!document.querySelector("[data-v3-nav]"));
    setT({ msg, undo, key: Date.now() });
    timer.current = window.setTimeout(() => setT(null), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // the page may change right after the toast (e.g. login → profile): follow the tab bar
  useEffect(() => {
    if (!t) return;
    const id = window.setInterval(() => setOverNav(!!document.querySelector("[data-v3-nav]")), 150);
    return () => window.clearInterval(id);
  }, [t]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div
          key={t.key}
          role="status"
          aria-live="polite"
          className="v3"
          style={{
            position: "fixed",
            left: "50%",
            ...(overNav ? { bottom: "calc(96px + var(--sb, 0px))" } : { top: "calc(env(safe-area-inset-top, 0px) + 12px)" }),
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            gap: 14,
            minWidth: 260,
            maxWidth: "min(92vw, 420px)",
            padding: "12px 12px 12px 16px",
            borderRadius: 16,
            background: "#F5F5F5",
            color: "#000",
            boxShadow: "0 16px 40px rgba(0,0,0,.5)",
            animation: `gpToast .35s ${EASE} both`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 'DM Sans',sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.msg}</span>
          {t.undo && (
            <button
              type="button"
              onClick={() => {
                t.undo?.();
                setT(null);
              }}
              style={{ border: 0, background: "transparent", padding: "4px 6px", font: "700 14px/1 'DM Sans',sans-serif", color: "#C62D1E" }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ───────── leave transition (0–380 ms before Detail opens) ───────── */
export function useOpenDetail() {
  const navigate = useNavigate();
  const busy = useRef(false);
  const timer = useRef<number>();
  const { key } = useLocation();
  // the user went somewhere else meanwhile (tab tap) → don't hijack it
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    busy.current = false;
    const page = document.querySelector<HTMLElement>(".v3-page");
    if (page) delete page.dataset.leaving;
  }, [key]);
  return useCallback(
    (it: Pick<Item, "id" | "kind">) => {
      if (busy.current) return;
      const page = document.querySelector<HTMLElement>(".v3-page");
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!page || reduce) return navigate(detailPath(it));
      busy.current = true;
      page.dataset.leaving = "1";
      timer.current = window.setTimeout(() => {
        busy.current = false;
        navigate(detailPath(it));
        // the same page component may stay mounted (detail → detail): bring it back
        window.setTimeout(() => page.isConnected && delete page.dataset.leaving, 30);
      }, 380);
    },
    [navigate]
  );
}

/* ───────── bottom nav: Home · Search · Potli · My List · Profile ───────── */
export function PotliIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 3.2c1.4 1.1 2.9 1.1 4.5 0 1.6 1.1 3.1 1.1 4.5 0" />
      <path d="M9.6 4.4 10.2 7M14.4 4.4 13.8 7" />
      <path d="M8.6 7.2h6.8" />
      <path d="M10.2 7.4C6.3 9.3 3.9 12.6 4.3 16c.4 2.9 3.3 4.8 7.7 4.8s7.3-1.9 7.7-4.8c.4-3.4-2-6.7-5.9-8.6" />
      <path d="M10.6 12.6v4.2l3.6-2.1z" fill="currentColor" />
    </svg>
  );
}

const TABS: { to: string; label: string; icon: "home" | "search" | "potli" | "list" | "profile" }[] = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/search", label: "Search", icon: "search" },
  { to: "/potli", label: "Potli", icon: "potli" },
  { to: "/watchlist", label: "My List", icon: "list" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const idx = TABS.findIndex((t) => (t.to === "/" ? pathname === "/" : pathname.startsWith(t.to)));
  const boxRef = useRef<HTMLElement>(null);
  const [w, setW] = useState(366);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const tabW = w / 5;
  return (
    <nav
      ref={boxRef}
      data-v3-nav
      aria-label="Tabs"
      style={{
        position: "fixed",
        left: "max(12px, calc(50% - 248px))",
        right: "max(12px, calc(50% - 248px))",
        bottom: "calc(14px + var(--sb))",
        zIndex: 40,
        height: 66,
        borderRadius: 24,
        background: "rgba(18,18,18,.78)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        backdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,.08)",
        boxShadow: "0 12px 40px rgba(0,0,0,.6)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 8,
          height: 50,
          width: 62,
          borderRadius: 18,
          background: "rgba(239,65,48,.16)",
          left: idx >= 0 ? idx * tabW + (tabW - 62) / 2 : 0,
          opacity: idx >= 0 ? 1 : 0,
          transition: "left .45s cubic-bezier(.3,1.4,.5,1),opacity .25s",
        }}
      />
      <div style={{ position: "relative", display: "flex", height: "100%" }}>
        {TABS.map((t, i) => {
          const on = i === idx;
          const Ico = t.icon === "home" ? House : t.icon === "search" ? Search : t.icon === "list" ? Bookmark : User;
          return (
            <button
              key={t.to}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => {
                if (on) window.scrollTo({ top: 0, behavior: "smooth" });
                else navigate(t.to);
              }}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                border: 0,
                background: "transparent",
                color: on ? "#F5F5F5" : "rgba(245,245,245,.6)",
                font: `${on ? 700 : 500} 11px/1 'DM Sans',sans-serif`,
                transition: "color .3s",
              }}
            >
              <span style={{ display: "flex", transform: `scale(${on ? 1.12 : 1})`, transition: "transform .45s cubic-bezier(.3,1.6,.5,1)" }}>
                {t.icon === "potli" ? <PotliIcon /> : <Ico size={22} fill={on && t.icon === "list" ? "currentColor" : "none"} />}
              </span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** One tab bar for all tab pages (mounted once in App): switching tabs only moves the pill, so it slides. */
const NAV_ROUTES = [/^\/$/, /^\/search/, /^\/potli/, /^\/watchlist/, /^\/profile/, /^\/section\//];
export function GlobalNav({ desktop }: { desktop: boolean }) {
  const { pathname } = useLocation();
  if (desktop || !NAV_ROUTES.some((r) => r.test(pathname))) return null;
  return (
    <div className="v3">
      <BottomNav />
    </div>
  );
}

/* ───────── page shell ───────── */
export function Shell({
  children,
  nav = false,
  ambient = false,
  style,
  className = "",
}: {
  children: ReactNode;
  nav?: boolean;
  ambient?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  useEffect(() => {
    document.body.style.background = "#000";
  }, []);
  return (
    <div className={`v3 ${ambient ? "ambient" : ""}`} style={{ minHeight: "100dvh", background: "#000" }}>
      <div
        className={`v3-page ${className}`}
        style={{ position: "relative", margin: "0 auto", maxWidth: 520, minHeight: "100dvh", overflowX: "clip", ...style }}
      >
        {children}
      </div>
      {/* the tab bar itself lives once in App (GlobalNav) so its pill slides between tabs */}
    </div>
  );
}

/* ───────── glass bottom sheet ───────── */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  // portal: above the tab bar (the page itself is its own stacking layer)
  return createPortal(
    <div
      className="v3"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)", animation: "gpFade .25s both" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "88dvh",
          overflowY: "auto",
          padding: "10px 20px calc(34px + var(--sb))",
          borderRadius: "28px 28px 0 0",
          background: "rgba(18,18,18,.72)",
          WebkitBackdropFilter: "blur(34px) saturate(1.5)",
          backdropFilter: "blur(34px) saturate(1.5)",
          borderTop: "1px solid rgba(255,255,255,.12)",
          animation: "gpSheet .4s cubic-bezier(.2,.9,.2,1) both",
        }}
      >
        <div style={{ margin: "0 auto 16px", height: 5, width: 40, borderRadius: 999, background: "rgba(255,255,255,.2)" }} />
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ───────── small pieces ───────── */
export function PremiumBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span
      style={{
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: sm ? 3 : 4,
        height: sm ? 20 : 22,
        padding: sm ? "0 7px" : "0 9px",
        borderRadius: 999,
        background: GOLD,
        color: GOLD_INK,
        font: "700 10px/1 'DM Sans',sans-serif",
        letterSpacing: sm ? 0 : ".06em",
        textTransform: sm ? "none" : "uppercase",
      }}
    >
      <Crown size={11} />
      Premium
    </span>
  );
}

export function Pic({ src, alt = "", style, pos, fallback = true }: { src?: string; alt?: string; style?: CSSProperties; pos?: string; fallback?: boolean }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [src]);
  if (!src || bad)
    return !fallback ? null : (
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "radial-gradient(120% 80% at 50% 0%, #3a1410 0%, #160807 55%, #0b0b0b 100%)", ...style }}>
        <span style={{ font: "800 13px/1 Outfit,sans-serif", letterSpacing: 1.5, color: "rgba(239,65,48,.55)", textTransform: "uppercase" }}>Gutargoo+</span>
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBad(true)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, ...style }}
    />
  );
}

/** 124×184 poster with title + "type · genre" under it */
export function PosterCard({ it, onOpen, width = 124, height = 184, showKind = true }: { it: Item; onOpen: (it: Item) => void; width?: number; height?: number; showKind?: boolean }) {
  return (
    <div className="press" onClick={() => onOpen(it)} role="link" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(it)} style={{ flexShrink: 0, width, cursor: "pointer", animation: "gpFade .5s both" }}>
      <div style={{ position: "relative", height, borderRadius: width < 120 ? 12 : 14, overflow: "hidden", background: "#1C1C1C" }}>
        <Pic src={it.poster} alt={it.title} />
        {isLocked(it) && (
          <span style={{ position: "absolute", left: 8, top: 8 }}>
            <PremiumBadge size="sm" />
          </span>
        )}
      </div>
      <p style={{ margin: "9px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 13px/1.3 'DM Sans',sans-serif" }}>{it.title}</p>
      {showKind && <p style={{ margin: "2px 0 0", font: "400 12px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>{kindGenre(it)}</p>}
    </div>
  );
}

export function SkeletonPosters({ n = 4 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 124 }}>
          <div className="shim" style={{ height: 184, borderRadius: 14 }} />
          <div style={{ marginTop: 10, height: 12, width: "80%", borderRadius: 6, background: "#1C1C1C" }} />
        </div>
      ))}
    </>
  );
}

export function HRow({ children, gap = 12, pad = "12px 18px 4px" }: { children: ReactNode; gap?: number; pad?: string }) {
  return (
    <div className="noscroll" style={{ display: "flex", gap, padding: pad, overflowX: "auto", scrollbarWidth: "none", overscrollBehaviorX: "contain" }}>
      {children}
    </div>
  );
}

export const H3 = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <h3 style={{ margin: 0, font: "700 19px/1.2 Outfit,sans-serif", ...style }}>{children}</h3>
);

export function Spinner({ size = 28 }: { size?: number }) {
  return <span style={{ display: "inline-block", height: size, width: size, borderRadius: 999, border: "3px solid rgba(255,255,255,.18)", borderTopColor: RED, animation: "gpSpin .7s linear infinite" }} />;
}

/** circle glass icon button (Back, Share…) */
export function GlassIcon({ label, onClick, children, size = 42 }: { label: string; onClick: () => void; children: ReactNode; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="glass-btn press-s press"
      style={{ whiteSpace: "nowrap", display: "flex", height: size, width: size, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, color: "#F5F5F5" }}
    >
      {children}
    </button>
  );
}
