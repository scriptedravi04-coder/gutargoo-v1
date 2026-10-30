// "Explore More" row on the details screen: posters 120×170, radius 6, crown badge on paid titles.
import { Link } from "react-router-dom";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { detailPath, Item } from "@v/lib/content";

export function PosterRow({ title, items, loading = false }: { title: string; items: Item[]; loading?: boolean }) {
  if (!loading && !items.length) return null;
  return (
    <section className="pb-6 pt-7">
      <h2 className="px-4 pb-3 text-base font-bold">{title}</h2>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-[170px] w-[120px] shrink-0 rounded-md" />)
          : items.map((it) => (
              <Link key={it.id} to={detailPath(it)} className="relative block shrink-0" aria-label={it.title}>
                {!it.isFree && <LockBadge />}
                <Img src={it.poster} alt={it.title} className="h-[170px] w-[120px] rounded-md" />
              </Link>
            ))}
      </div>
    </section>
  );
}
