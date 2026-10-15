import { Crown } from "lucide-react";

// Small crown on paid posters (web plays free titles only)
export function LockBadge() {
  return (
    <span className="absolute left-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] px-1.5 py-0.5 text-[9px] font-bold text-black">
      <Crown className="h-2.5 w-2.5" /> APP
    </span>
  );
}
