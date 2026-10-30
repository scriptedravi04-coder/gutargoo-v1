// Player settings (v3): glass sheet with a sliding Quality / Speed switch.
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { QualityLevel } from "./useHls";

export const SPEEDS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  levels: QualityLevel[];
  level: number;
  onLevel: (index: number) => void;
  speed: number;
  onSpeed: (s: number) => void;
}

export function SettingsSheet({ open, onClose, levels, level, onLevel, speed, onSpeed }: Props) {
  const hasQuality = levels.length > 0;
  const [tab, setTab] = useState<"quality" | "speed">("quality");
  const boxRef = useRef<HTMLDivElement>(null);
  const current = hasQuality ? tab : "speed";
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const box = boxRef.current;
      (box?.querySelector<HTMLElement>('[data-selected="true"]') || box?.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, current]);

  if (!open) return null;

  // pick → tick pops in → the sheet closes 250 ms later
  const choose = (key: string, fn: () => void) => {
    setPicked(key);
    fn();
    window.setTimeout(onClose, 250);
  };

  const row = (key: string, label: string, selected: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      data-selected={selected}
      aria-pressed={selected}
      onClick={() => choose(key, onClick)}
      style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "14px 6px", border: 0, borderBottom: "1px solid rgba(255,255,255,.05)", background: "transparent", color: selected ? "#F5F5F5" : "rgba(245,245,245,.75)", font: `${selected ? 700 : 500} 15px/1 'DM Sans',sans-serif` }}
    >
      <span>{label}</span>
      {selected && (
        <span key={picked === key ? "p" : "s"} style={{ display: "flex", color: "#EF4130", animation: "gpPop .4s both" }}>
          <Check size={20} />
        </span>
      )}
    </button>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.6)", animation: "gpFade .25s both" }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        ref={boxRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Player settings"
        style={{ width: "100%", maxWidth: 520, maxHeight: "80dvh", overflowY: "auto", padding: "10px 20px calc(18px + env(safe-area-inset-bottom, 0px))", borderRadius: "24px 24px 0 0", background: "rgba(18,18,18,.82)", WebkitBackdropFilter: "blur(34px) saturate(1.5)", backdropFilter: "blur(34px) saturate(1.5)", borderTop: "1px solid rgba(255,255,255,.12)", animation: "gpSheet .4s cubic-bezier(.2,.9,.2,1) both", fontFamily: "'DM Sans',system-ui,sans-serif" }}
      >
        <div style={{ margin: "0 auto 12px", height: 5, width: 40, borderRadius: 999, background: "rgba(255,255,255,.2)" }} />
        {hasQuality && (
          <div style={{ position: "relative", display: "flex", padding: 4, borderRadius: 999, background: "#000" }}>
            <span style={{ position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)", borderRadius: 999, background: "#F5F5F5", left: current === "quality" ? 4 : "50%", transition: "left .35s cubic-bezier(.3,1.3,.5,1)" }} />
            {(["quality", "speed"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} style={{ position: "relative", flex: 1, height: 36, border: 0, background: "transparent", color: current === k ? "#000" : "rgba(245,245,245,.75)", font: "700 13px/1 'DM Sans',sans-serif", transition: "color .3s" }}>
                {k === "quality" ? "Quality" : "Speed"}
              </button>
            ))}
          </div>
        )}
        {!hasQuality && <p style={{ margin: "0 0 4px", font: "700 15px/1 Outfit,sans-serif", color: "#F5F5F5" }}>Speed</p>}
        <div style={{ marginTop: 10 }}>
          {current === "quality" ? (
            <>
              {row("auto", "Auto", level === -1, () => onLevel(-1))}
              {levels.map((l) => row(`q${l.index}`, `${l.height}p`, level === l.index, () => onLevel(l.index)))}
            </>
          ) : (
            SPEEDS.map((s) => row(`s${s.value}`, s.label, speed === s.value, () => onSpeed(s.value)))
          )}
        </div>
      </div>
    </div>
  );
}
