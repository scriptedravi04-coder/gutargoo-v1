import { Crown } from "lucide-react";

// Gold "Go Pro" pill from the app header, with the white shine sweeping across every second.
export function GoProPill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="gp-gopro relative inline-flex h-8 shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] px-3 text-xs font-bold text-black shadow-[0_4px_10px_rgba(255,165,0,.6)]"
    >
      <style>{`
        .gp-gopro::after{content:"";position:absolute;inset:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.75),transparent);transform:translateX(-150%) skewX(-20deg);animation:gp-gopro-shine 1s linear infinite;pointer-events:none}
        @keyframes gp-gopro-shine{to{transform:translateX(350%) skewX(-20deg)}}
        @media (prefers-reduced-motion: reduce){.gp-gopro::after{animation:none;display:none}}
      `}</style>
      <Crown className="h-3 w-3" fill="currentColor" />
      Go Pro
    </button>
  );
}
