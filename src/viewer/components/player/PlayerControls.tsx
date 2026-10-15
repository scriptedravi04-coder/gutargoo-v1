// The overlay on top of the video: top row, centre buttons, seek bar. Purely visual —
// VideoPlayer owns the state. Blank areas let taps through to the video surface underneath.
import { ReactNode } from "react";
import clsx from "clsx";
import { ArrowLeft, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Settings, Volume2, VolumeX } from "lucide-react";
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
}

const IconBtn = ({ label, onClick, children, className }: { label: string; onClick: () => void; children: ReactNode; className?: string }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    onDoubleClick={(e) => e.stopPropagation()}
    className={clsx("pointer-events-auto flex items-center justify-center", className)}
  >
    {children}
  </button>
);

function TenIcon({ forward }: { forward?: boolean }) {
  const Icon = forward ? RotateCw : RotateCcw;
  return (
    <span className="relative flex h-7 w-7 items-center justify-center">
      <Icon className="h-7 w-7" strokeWidth={1.8} />
      <span className="absolute text-[9px] font-bold">10</span>
    </span>
  );
}

export function PlayerControls(p: Props) {
  const pct = p.duration > 0 ? Math.min(100, (p.current / p.duration) * 100) : 0;
  const bufPct = p.duration > 0 ? Math.min(100, (p.buffered / p.duration) * 100) : 0;

  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300",
        p.visible ? "opacity-100" : "opacity-0 [&_*]:!pointer-events-none"
      )}
    >
      {/* top row */}
      <div className="flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent px-1 pb-6 pt-1">
        <IconBtn label="Back" onClick={p.onBack} className="h-10 w-10 rounded-full hover:bg-white/10">
          <ArrowLeft className="h-6 w-6" />
        </IconBtn>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight">{p.title}</p>
          {p.subtitle && <p className="truncate text-xs text-white/70">{p.subtitle}</p>}
        </div>
        <IconBtn label="Settings" onClick={p.onSettings} className="h-10 w-10 rounded-full hover:bg-white/10">
          <Settings className="h-5 w-5" />
        </IconBtn>
        <IconBtn label={p.isFs ? "Exit full screen" : "Full screen"} onClick={p.onFullscreen} className="h-10 w-10 rounded-full hover:bg-white/10">
          {p.isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </IconBtn>
      </div>

      {/* centre */}
      <div className="flex items-center justify-center gap-7">
        <IconBtn label="Back 10 seconds" onClick={() => p.onSeekBy(-10)} className="rounded-full bg-black/65 p-3">
          <TenIcon />
        </IconBtn>
        <IconBtn label={p.playing ? "Pause" : "Play"} onClick={p.onTogglePlay} className="rounded-full bg-black/65 p-3">
          {p.playing ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="h-7 w-7" fill="currentColor" />}
        </IconBtn>
        <IconBtn label="Forward 10 seconds" onClick={() => p.onSeekBy(10)} className="rounded-full bg-black/65 p-3">
          <TenIcon forward />
        </IconBtn>
      </div>

      {/* bottom: seek bar + time */}
      <div className="bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        <div className="pointer-events-auto relative flex h-5 items-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="relative h-1 w-full rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#E50914]" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E50914]" style={{ left: `${pct}%` }} />
          </div>
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={p.duration || 0}
            step={1}
            value={Math.min(p.current, p.duration || 0)}
            onChange={(e) => p.onSeekTo(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-xs text-white/70">
            {formatTime(p.current)} / {formatTime(p.duration)}
          </span>
          <IconBtn label={p.muted ? "Unmute" : "Mute"} onClick={p.onMute} className="h-8 w-8 rounded-full hover:bg-white/10">
            {p.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </IconBtn>
        </div>
      </div>
    </div>
  );
}
