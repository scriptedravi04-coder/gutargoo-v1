import type { CSSProperties } from "react";
import type { Item } from "@v/lib/content";
import { HScroll } from "./HScroll";
import { PosterCard } from "./PosterCard";

// Rank number drawn like the app: black 12px stroke, #212121 8px stroke, then a white fill with shadows.
const layer: CSSProperties = { position: "absolute", left: 0, bottom: 0, whiteSpace: "nowrap" };

function RankNumber({ n }: { n: number }) {
  return (
    <span className="rank-number pointer-events-none absolute bottom-[5px] left-[-30px] select-none" aria-hidden="true">
      <span style={{ ...layer, color: "#000", WebkitTextStroke: "12px #000" }}>{n}</span>
      <span style={{ ...layer, color: "#212121", WebkitTextStroke: "8px #212121" }}>{n}</span>
      <span
        style={{
          ...layer,
          position: "relative",
          color: "#fff",
          textShadow: "3px 3px 25px rgba(0,0,0,.9), 1px 1px 15px rgba(0,0,0,.5)",
        }}
      >
        {n}
      </span>
    </span>
  );
}

// "Top 10" row (displayStyle index_vertical)
export function Top10Row({ items }: { items: Item[] }) {
  return (
    <HScroll className="h-[170px] pl-10 pr-[30px]">
      {items.slice(0, 10).map((it, i) => (
        <div key={it.id} className="relative mr-[50px] h-full w-[140px] shrink-0">
          <RankNumber n={i + 1} />
          <PosterCard
            item={it}
            className="!absolute bottom-[5px] left-[30px] top-[5px] w-[120px] rounded-[6px] shadow-[0_5px_15px_rgba(0,0,0,.7)]"
          />
        </div>
      ))}
    </HScroll>
  );
}
