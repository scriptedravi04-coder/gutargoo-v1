import clsx from "clsx";
import type { Category } from "@v/hooks/useCatalog";
import { HScroll } from "./HScroll";

// "Home · Movies · TV Shows · Web Series" pills, sticky under the header.
export function CategoryChips({ categories, selected, onSelect }: { categories: Category[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <HScroll className="h-[52px] items-center gap-1 px-2.5">
      {categories.map((c) => {
        const active = c.id === selected;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={active}
            className={clsx(
              "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm transition-colors",
              active ? "bg-white/15 font-bold text-white" : "bg-white/[.08] font-normal text-white/60 hover:text-white/80"
            )}
          >
            {c.name}
          </button>
        );
      })}
    </HScroll>
  );
}

export function ChipsShimmer() {
  return (
    <div className="flex h-[52px] items-center gap-1 px-2.5">
      {[64, 72, 80, 92].map((w) => (
        <div key={w} className="shimmer h-8 rounded-full" style={{ width: w }} />
      ))}
    </div>
  );
}
