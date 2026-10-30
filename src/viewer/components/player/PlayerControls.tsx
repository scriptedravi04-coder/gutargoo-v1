// v3 overlay on top of the video (notes 05): collapse · episode line · settings · fullscreen;
// −10 s · play/pause · +10 s; seek bar with buffer, current time and time remaining.
// Purely visual — VideoPlayer owns the state. Blank areas let taps through to the surface underneath.
import { ReactNode, useRef, useState } from "react";
import { ChevronDown, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Settings2 } from "lucide-react";
import { formatTime } from "@v/lib/content";

interface Props {
  visible: boolean;
  playing: boolean;
  current: number;
  duration: number;
  buffered: number;
  title: string;
  subtitle?: string;
  isFs: boolean;
  muted: boolean;
  onBack: () => void;
  onTogglePlay: () => void;
  onSeekBy: (delta: number) => void;
  onSeekTo: (t: number) => void;
  onSettings: () => void;
  onFullscreen: () => void;
  onMute: () => void;
  /** called while the seek bar is being dragged (keeps the controls on screen) */
  onScrub?: () => void;
}

const btn = (e: React.MouseEvent, fn: () => void) => {
  e.stopPropagation();
  // mouse / touch click: give focus back to the player so ← → keep seeking (remote OK keeps it on the button)
  if (e.detail > 0) (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-player]")?.focus({ preventScroll: true });
  fn();
};

function Btn({ label, onClick, children, style }: { label: string; onClick: () => void; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-ng="1"
      onClick={(e) => btn(e, onClick)}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="gp-pbtn"
      style={{ pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center", border: 0, background: "transparent", color: "#fff", ...style }}
    >
      {children}
    </button>
  );
}

const fmt = (t: number) => formatTime(t).replace(/^0(\d:)/, "$1");

export function PlayerControls(p: Props) {
  // dragging the seek bar only moves it here; the video seeks once on release
  const [scrub, setScrub] = useState<number | null>(null);
  const dragging = useRef(false);
  const scrubRef = useRef<number | null>(null);
  const shown = scrub ?? p.current;
  const commit = () => {
    dragging.current = false;
    const v = scrubRef.current;
    scrubRef.current = null;
    if (v !== null) p.onSeekTo(v);
    setScrub(null);
  };
  const pct = p.duration > 0 ? Math.min(100, (shown / p.duration) * 100) : 0;
  const bufPct = p.duration > 0 ? Math.min(100, (p.buffered / p.duration) * 100) : 0;
  const line = p.subtitle || p.title;

  return (
    <div
      className={p.visible ? "" : "[&_*]:!pointer-events-none"}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "rgba(0,0,0,.42)",
        opacity: p.visible ? 1 : 0,
        transition: "opacity .35s",
        pointerEvents: "none",
        fontFamily: "'DM Sans',system-ui,sans-serif",
      }}
    >
      {/* top row */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: p.isFs ? "max(10px, env(safe-area-inset-top)) 12px 0" : "6px 6px 0" }}>
        <Btn label={p.isFs ? "Exit full screen" : "Back"} onClick={p.onBack} style={{ height: 40, width: 40, borderRadius: 999 }}>
          <ChevronDown size={24} />
        </Btn>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "600 13px/1.2 'DM Sans',sans-serif", color: "rgba(255,255,255,.85)" }}>{line}</span>
        <Btn label="Quality and speed" onClick={p.onSettings} style={{ height: 40, width: 40, borderRadius: 999 }}>
          <Settings2 size={20} />
        </Btn>
        <Btn label={p.isFs ? "Exit full screen" : "Full screen"} onClick={p.onFullscreen} style={{ height: 40, width: 40, borderRadius: 999 }}>
          {p.isFs ? <Minimize size={20} /> : <Maximize size={20} />}
        </Btn>
      </div>

      {/* centre */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: p.isFs ? 64 : 40 }}>
        <Btn label="Back 10 seconds" onClick={() => p.onSeekBy(-10)} style={{ position: "relative" }}>
          <RotateCcw size={30} strokeWidth={1.6} />
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px/1 'DM Sans',sans-serif" }}>10</span>
        </Btn>
        <Btn label={p.playing ? "Pause" : "Play"} onClick={p.onTogglePlay} style={{ height: 64, width: 64, borderRadius: 999, background: "rgba(255,255,255,.95)", color: "#000", paddingLeft: p.playing ? 0 : 3 }}>
          {p.playing ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </Btn>
        <Btn label="Forward 10 seconds" onClick={() => p.onSeekBy(10)} style={{ position: "relative" }}>
          <RotateCw size={30} strokeWidth={1.6} />
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", font: "700 9px/1 'DM Sans',sans-serif" }}>10</span>
        </Btn>
      </div>

      {/* seek bar + times */}
      <div style={{ padding: p.isFs ? "0 20px max(14px, env(safe-area-inset-bottom))" : "0 14px 10px" }}>
        <div
          data-ng="1"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ position: "relative", height: 20, margin: "-8px 0", display: "flex", alignItems: "center", pointerEvents: "auto" }}
        >
          <div style={{ position: "relative", height: 4, width: "100%", borderRadius: 999, background: "rgba(255,255,255,.25)" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${bufPct}%`, borderRadius: 999, background: "rgba(255,255,255,.4)" }} />
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, borderRadius: 999, background: "#EF4130" }} />
            <div style={{ position: "absolute", top: "50%", left: `${pct}%`, height: 14, width: 14, transform: "translate(-50%,-50%)", borderRadius: 999, background: "#fff", boxShadow: "0 0 0 4px rgba(239,65,48,.35)" }} />
          </div>
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={p.duration || 0}
            step={1}
            value={Math.min(shown, p.duration || 0)}
            onPointerDown={() => {
              dragging.current = true;
            }}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (dragging.current) {
                scrubRef.current = v;
                setScrub(v);
                p.onScrub?.();
              } else p.onSeekTo(v); // keyboard (Home / End / PageUp …)
            }}
            onPointerUp={commit}
            onPointerCancel={commit}
            onLostPointerCapture={() => dragging.current && commit()}
            onBlur={() => dragging.current && commit()}
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", cursor: "pointer", touchAction: "none", opacity: 0, margin: 0 }}
          />
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", font: "500 11px/1 'DM Sans',sans-serif", color: "rgba(255,255,255,.8)" }}>
          <span>{fmt(shown)}</span>
          <span>-{fmt(Math.max(0, p.duration - shown))}</span>
        </div>
      </div>
    </div>
  );
}
