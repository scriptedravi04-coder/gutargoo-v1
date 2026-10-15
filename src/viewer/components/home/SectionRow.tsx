import type { Section } from "@v/hooks/useCatalog";
import { BigVerticalPager } from "./BigVerticalPager";
import { HScroll } from "./HScroll";
import { PosterCard } from "./PosterCard";
import { SectionHeader } from "./SectionHeader";
import { Top10Row } from "./Top10Row";

// One Home section: header + the layout its displayStyle asks for.
export function SectionRow({ section, viewAllQuery = "" }: { section: Section; viewAllQuery?: string }) {
  const { style, items } = section;
  let body;
  if (style === "index_vertical" || style === "index_horizontal") {
    body = <Top10Row items={items} />;
  } else if (style === "big_vertical") {
    body = <BigVerticalPager items={items} />;
  } else if (style === "horizontal_banner") {
    body = (
      <HScroll className="h-[100px] gap-2.5 px-[15px]">
        {items.map((it) => (
          <PosterCard key={it.id} item={it} image={it.banner} className="h-[100px] w-[180px] rounded-lg" />
        ))}
      </HScroll>
    );
  } else {
    // vertical_banner, big_horizontal and anything unknown → standard poster row
    body = (
      <HScroll className="h-[170px] gap-2.5 px-[15px]">
        {items.map((it) => (
          <PosterCard key={it.id} item={it} className="h-[170px] w-[120px] rounded-[6px]" />
        ))}
      </HScroll>
    );
  }

  return (
    <section className="mb-4">
      <SectionHeader title={section.title} viewAllTo={`/section/${section.id}${viewAllQuery}`} />
      <div className="mt-1.5">{body}</div>
    </section>
  );
}

export function SectionShimmer() {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-4 py-[5px]">
        <div className="shimmer h-4 w-32 rounded" />
        <div className="shimmer h-4 w-14 rounded" />
      </div>
      <div className="mt-1.5 flex gap-2.5 overflow-hidden px-[15px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer h-[170px] w-[120px] shrink-0 rounded-[6px]" />
        ))}
      </div>
    </div>
  );
}
