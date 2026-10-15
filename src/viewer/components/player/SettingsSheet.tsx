// Player settings: Quality (from the HLS playlist) and Speed — a black sheet like the app's.
import { useState } from "react";
import clsx from "clsx";
import { Check, X } from "lucide-react";
import type { QualityLevel } from "./useHls";

export const SPEEDS: { value: number; label: string }[] = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1, label: "1x Normal" },
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
  if (!open) return null;
  const current = hasQuality ? tab : "speed";

  const Row = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={clsx("flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-white/5", selected ? "font-semibold text-white" : "text-white/70")}
    >
      {label}
      {selected && <Check className="h-5 w-5 text-[#448AFF]" />}
    </button>
  );

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center bg-black/50"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="animate-pop max-h-[85%] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-black pb-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Player settings"
      >
        <div className="flex items-center border-b border-white/10">
          {hasQuality && (
            <button
              type="button"
              onClick={() => setTab("quality")}
              className={clsx("flex-1 border-b-2 py-3 text-sm font-bold", current === "quality" ? "border-white text-white" : "border-transparent text-white/40")}
            >
              Quality
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("speed")}
            className={clsx("flex-1 border-b-2 py-3 text-sm font-bold", current === "speed" ? "border-white text-white" : "border-transparent text-white/40")}
          >
            Speed
          </button>
          <button type="button" onClick={onClose} aria-label="Close settings" className="px-4 py-3 text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {current === "quality" ? (
          <div>
            <Row label="Auto" selected={level === -1} onClick={() => (onLevel(-1), onClose())} />
            {levels.map((l) => (
              <Row key={l.index} label={`${l.height}p`} selected={level === l.index} onClick={() => (onLevel(l.index), onClose())} />
            ))}
          </div>
        ) : (
          <div>
            {SPEEDS.map((s) => (
              <Row key={s.value} label={s.label} selected={speed === s.value} onClick={() => (onSpeed(s.value), onClose())} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
