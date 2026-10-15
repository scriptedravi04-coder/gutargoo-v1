// Poster rows under the player ("Similar Videos" / "Trending Videos" / "EXPLORE MORE"),
// each poster with the "+ Watchlist" button like the app's player screen.
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Check, Plus } from "lucide-react";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { detailPath, Item } from "@v/lib/content";

export function ExploreRow({ title, items, compact = false, loading = false }: { title: string; items: Item[]; compact?: boolean; loading?: boolean }) {
  const { has, toggle } = useWatchlist();
  if (!loading && items.length === 0) return null;

  return (
    <section className="pt-4">
      <h2 className={clsx("px-4 pb-2.5 text-base text-white", compact ? "font-bold uppercase" : "font-bold")}>{title}</h2>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[110px] shrink-0">
                <div className="shimmer h-[170px] w-[110px] rounded-lg" />
                <div className="shimmer mt-1.5 h-[26px] rounded" />
              </div>
            ))
          : items.map((it) => {
              const added = has(it.id);
              return (
                <div key={it.id} className="w-[110px] shrink-0">
                  <Link to={detailPath(it)} className="relative block" aria-label={it.title}>
                    {!it.isFree && <LockBadge />}
                    <Img src={it.poster} alt={it.title} className="h-[170px] w-[110px] rounded-lg" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(it)}
                    aria-pressed={added}
                    className={clsx(
                      "mt-1.5 flex w-full items-center justify-center gap-1 rounded border-[0.8px] text-[10px] font-semibold",
                      compact ? "px-2 py-[5px]" : "px-2.5 py-[5px]",
                      added ? "border-green-500/60 bg-green-500/15 text-white" : "border-white/20 bg-gradient-to-b from-white/[.08] to-white/[.02] text-white"
                    )}
                  >
                    {added ? <Check className="h-4 w-4 text-[#69F0AE]" /> : <Plus className="h-4 w-4" />}
                    {added ? "Added" : "My List"}
                  </button>
                </div>
              );
            })}
      </div>
    </section>
  );
}
