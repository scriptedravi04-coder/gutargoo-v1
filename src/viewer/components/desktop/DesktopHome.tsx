// Big-screen Home: hero + rows (same data and admin sections as the app).
import type { Banner, Section } from "@v/hooks/useCatalog";
import { EmptyState, ErrorState, PartialRetry } from "@v/components/States";
import { ContinueWatchingRow } from "@v/components/home/ContinueWatchingRow";
import { DesktopHero, DesktopHeroShimmer } from "./DesktopHero";
import { DesktopRow, LandscapeTile, PosterTile, RowShimmer, Scroller, Top10Tile } from "./Rows";

export function DesktopSection({ section, viewAllQuery = "" }: { section: Section; viewAllQuery?: string }) {
  const { style, items } = section;
  let body;
  if (style === "index_vertical" || style === "index_horizontal") {
    body = (
      <Scroller className="gap-[1.4rem]">
        {items.slice(0, 10).map((it, i) => (
          <Top10Tile key={it.id} item={it} rank={i + 1} />
        ))}
      </Scroller>
    );
  } else if (style === "big_vertical") {
    body = (
      <Scroller>
        {items.map((it) => (
          <PosterTile key={it.id} item={it} size="lg" />
        ))}
      </Scroller>
    );
  } else if (style === "horizontal_banner" || style === "big_horizontal") {
    body = (
      <Scroller>
        {items.map((it) => (
          <LandscapeTile key={it.id} item={it} />
        ))}
      </Scroller>
    );
  } else {
    body = (
      <Scroller>
        {items.map((it) => (
          <PosterTile key={it.id} item={it} />
        ))}
      </Scroller>
    );
  }
  return (
    <DesktopRow title={section.title} viewAllTo={`/section/${section.id}${viewAllQuery}`}>
      {body}
    </DesktopRow>
  );
}

export function DesktopHome({
  banners,
  sections,
  heading,
  isHome,
  loading,
  error,
  partialError,
  onRetry,
  viewAllQuery,
}: {
  banners: Banner[];
  sections: Section[];
  heading?: string;
  isHome: boolean;
  loading: boolean;
  error: boolean;
  partialError?: boolean;
  onRetry: () => void;
  viewAllQuery: string;
}) {
  if (loading) {
    return (
      <>
        <DesktopHeroShimmer />
        <div className="relative z-10 -mt-24">
          <RowShimmer />
          <RowShimmer />
        </div>
      </>
    );
  }
  if (error) return <div className="pt-24"><ErrorState onRetry={onRetry} /></div>;
  if (!sections.length && !banners.length) return <div className="pt-24"><EmptyState title="No content available" subtitle="Please check back soon." /></div>;

  return (
    <>
      {banners.length > 0 ? <DesktopHero banners={banners} /> : <div className="h-24" />}
      <div className={banners.length > 0 ? "relative z-10 -mt-[9vw]" : ""}>
        {heading && <h1 className="mb-4 px-[4%] text-3xl font-black">{heading}</h1>}
        {partialError && (
          <div className="px-[4%]">
            <PartialRetry onRetry={onRetry} />
          </div>
        )}
        {isHome && <ContinueWatchingRow />}
        {sections.map((s) => (
          <DesktopSection key={s.id} section={s} viewAllQuery={viewAllQuery} />
        ))}
      </div>
    </>
  );
}
