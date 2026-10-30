import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Kind } from "@v/lib/content";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { DesktopHome } from "@v/components/desktop/DesktopHome";
import { InstallDialogs, useInstallAction } from "@v/components/InstallPrompt";
import { Download } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { EmptyState, ErrorState, PartialRetry } from "@v/components/States";
import { useCatalog } from "@v/hooks/useCatalog";
import type { Category, Section } from "@v/hooks/useCatalog";
import { CategoryChips, ChipsShimmer } from "@v/components/home/CategoryChips";
import { ContinueWatchingRow } from "@v/components/home/ContinueWatchingRow";
import { GoProPill } from "@v/components/home/GoProPill";
import { HeroCarousel, HeroShimmer } from "@v/components/home/HeroCarousel";
import { HomePopup } from "@v/components/home/HomePopup";
import { SectionRow, SectionShimmer } from "@v/components/home/SectionRow";
import { useDominantColor } from "@v/components/home/useDominantColor";

// used when GET /category returns nothing (same list as the app)
const FALLBACK_CATEGORIES: Category[] = [
  { id: "home", name: "Home", kind: null },
  { id: "movies", name: "Movies", kind: "movie" },
  { id: "tvshows", name: "TV Shows", kind: "tvshow" },
  { id: "webseries", name: "Web Series", kind: "webseries" },
];

const COLOR_TRANSITION = { transition: "background-color 200ms ease-in-out" };

export default function Home() {
  const { sections, banners, categories: apiCategories, loading, error, refetch } = useCatalog();
  const categories = apiCategories.length > 1 ? apiCategories : FALLBACK_CATEGORIES;
  const desktop = useIsDesktop();
  const install = useInstallAction();
  // selected category lives in the URL (?c=movie|webseries|tvshow) so the top menu, Back and shared links keep it
  const [params, setParams] = useSearchParams();
  const cParam = params.get("c");
  const kind: Kind | null = cParam === "movie" || cParam === "webseries" || cParam === "tvshow" ? cParam : null;
  const categoryId = (kind && categories.find((c) => c.kind === kind)?.id) || "home";
  const [slide, setSlide] = useState(0);
  const [proOpen, setProOpen] = useState(false);
  const isHome = kind === null;

  // Same filter as the app: banners by type, section items by type, empty sections hidden,
  // and if a category leaves nothing at all, show everything.
  const shownBanners = useMemo(() => {
    if (isHome) return banners;
    const f = banners.filter((b) => b.kind === kind);
    return f.length ? f : banners;
  }, [banners, kind, isHome]);

  const shownSections = useMemo<Section[]>(() => {
    if (isHome) return sections;
    const f = sections.map((s) => ({ ...s, items: s.items.filter((it) => it.kind === kind) })).filter((s) => s.items.length > 0);
    return f.length ? f : sections;
  }, [sections, kind, isHome]);

  const onSlide = useCallback((i: number) => setSlide(i), []);
  const color = useDominantColor(shownBanners[slide]?.image || shownBanners[0]?.image);
  const tint = { ...COLOR_TRANSITION, backgroundColor: color };

  const selectCategory = (id: string) => {
    const k = categories.find((c) => c.id === id)?.kind ?? null;
    setParams(k ? { c: k } : {}, { replace: true });
    setSlide(0);
  };

  if (desktop) {
    const heading = kind ? categories.find((c) => c.kind === kind)?.name : undefined;
    return (
      <AppShell wide overlay>
        <DesktopHome
          banners={shownBanners}
          sections={shownSections}
          heading={heading}
          isHome={isHome}
          loading={loading}
          error={!!error && !sections.length}
          partialError={!!error && sections.length > 0}
          onRetry={() => void refetch()}
          viewAllQuery={kind ? `?c=${kind}` : ""}
        />
        <HomePopup />
      </AppShell>
    );
  }

  let content;
  if (loading) {
    content = (
      <>
        <HeroShimmer />
        <div className="pt-1">
          <SectionShimmer />
          <SectionShimmer />
        </div>
      </>
    );
  } else if (error && !sections.length) {
    content = <ErrorState onRetry={() => void refetch()} />;
  } else if (!shownSections.length && !shownBanners.length) {
    content = <EmptyState title="No content available" subtitle="Please check back soon." />;
  } else {
    content = (
      <>
        {shownBanners.length > 0 && (
          <div className="relative pb-5" style={tint}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_30%,#000_70%)]" />
            <div className="relative">
              <HeroCarousel banners={shownBanners} onIndexChange={onSlide} />
            </div>
          </div>
        )}
        <div className="bg-black pb-4 pt-1">
          {error && <PartialRetry onRetry={() => void refetch()} />}
          {isHome && <ContinueWatchingRow />}
          {shownSections.map((s) => (
            <SectionRow key={s.id} section={s} viewAllQuery={kind ? `?c=${kind}` : ""} />
          ))}
        </div>
      </>
    );
  }

  return (
    <AppShell>
      {/* top bar — scrolls away */}
      <header className="flex h-14 items-center justify-between gap-3 px-4" style={tint}>
        <img src="/img/Bevel.png" alt="Gutargoo+" className="h-auto w-[132px] shrink-0 select-none" draggable={false} />
        <div className="flex items-center gap-2">
          {install.showButton && (
            <button
              type="button"
              onClick={() => void install.run()}
              aria-label="Install Gutargoo+"
              className="flex h-8 items-center gap-1 rounded-full border border-white/30 px-3 text-xs font-semibold"
            >
              <Download className="h-3 w-3" /> Install
            </button>
          )}
          <GoProPill onClick={() => setProOpen(true)} />
        </div>
      </header>

      {/* category chips — stick to the top */}
      <div className="sticky-top z-30" style={tint}>
        {loading ? <ChipsShimmer /> : <CategoryChips categories={categories} selected={categoryId} onSelect={selectCategory} />}
      </div>

      {content}

      <HomePopup />
      <InstallDialogs action={install} />
      <AppOnlySheet
        open={proOpen}
        heading="Gutargoo+ Premium"
        message="Premium plans are available in the Gutargoo+ mobile app. On the web you can watch all free movies and series."
        onClose={() => setProOpen(false)}
      />
    </AppShell>
  );
}
