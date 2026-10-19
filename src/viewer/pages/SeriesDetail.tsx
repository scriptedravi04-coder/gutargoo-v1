// Web series / TV show details: same top as movies, then EPISODES | MORE LIKE THIS tabs.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import type { ApiEpisode } from "@v/lib/api";
import { detailPath, episodeUrl, kindLabel, seriesPlayTarget } from "@v/lib/content";
import { useCatalog } from "@v/hooks/useCatalog";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { DesktopDetail } from "@v/components/desktop/DesktopDetail";
import { AppShell } from "@v/components/AppShell";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { TrailerHero, TrailerHeroHandle } from "@v/components/detail/TrailerHero";
import { Description, InfoRow, TitleLogo } from "@v/components/detail/InfoRow";
import { ActionPills } from "@v/components/detail/ActionPills";
import { CastRow } from "@v/components/detail/CastRow";
import { EpisodeList } from "@v/components/detail/EpisodeList";
import { ComingSoonDialog } from "@v/components/detail/ComingSoonDialog";
import { useSeriesQuery } from "@v/components/detail/queries";
import { DetailError, DetailSkeleton, isNotFound, PlayButton } from "@v/components/detail/DetailParts";

export default function SeriesDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const heroRef = useRef<TrailerHeroHandle>(null);
  const [tab, setTab] = useState<"episodes" | "more">("episodes");
  const [appOnly, setAppOnly] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [trailerOk, setTrailerOk] = useState(true);
  const desktop = useIsDesktop();

  const q = useSeriesQuery(id);
  const catalog = useCatalog();

  useEffect(() => {
    setTab("episodes"); // page scroll is handled by ScrollManager
  }, [id]);

  const item = q.data;
  const more = useMemo(() => catalog.everything.filter((x) => x.kind !== "movie" && x.id !== id), [catalog.everything, id]);

  if (q.isLoading) return <DetailSkeleton />;
  if (q.error || !item) return <DetailError notFound={isNotFound(q.error)} onRetry={() => q.refetch()} />;

  const label = kindLabel(item.kind) as "Web Series" | "TV Show";
  // resume this device's episode, else the first playable one (any season)
  const target = seriesPlayTarget(item);

  const playEpisode = (ep: ApiEpisode | undefined) => {
    if (!item.isFree) return setAppOnly(true);
    if (!ep || !episodeUrl(ep)) return setComingSoon(true);
    navigate(`/watch/series/${item.id}?ep=${ep._id}`);
  };
  const playFirst = () => playEpisode(target.ep);

  if (desktop) {
    return (
      <AppShell wide overlay>
        <DesktopDetail key={item.id} item={item} onPlay={playFirst} playLabel={target.label} onPlayEpisode={playEpisode} more={more} moreTitle="More Like This" moreLoading={catalog.loading} />
        <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
        <ComingSoonDialog open={comingSoon} label={label} onClose={() => setComingSoon(false)} />
      </AppShell>
    );
  }

  return (
    <AppShell nav={false}>
      <div className="sticky-top-portrait relative z-30 bg-black">
        <TrailerHero key={item.id} ref={heroRef} item={item} onPlay={playFirst} onAvailable={setTrailerOk} />
      </div>
      <TitleLogo item={item} />
      <InfoRow item={item} />
      <PlayButton onClick={playFirst} label={target.shortLabel} />
      <Description text={item.description} />
      <ActionPills key={item.id} item={item} onTrailer={item.trailerUrl && trailerOk ? () => heroRef.current?.openFullscreen() : undefined} />
      <CastRow people={item.people} />

      {/* EPISODES | MORE LIKE THIS */}
      <div className="mt-4 flex border-b border-white/10" role="tablist">
        {(
          [
            ["episodes", "EPISODES"],
            ["more", "MORE LIKE THIS"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={clsx("flex-1 border-b-[3px] py-3 text-sm font-bold", tab === key ? "border-[#E50914] text-white" : "border-transparent text-white/40")}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="pb-8">
        {tab === "episodes" ? (
          <EpisodeList seasons={item.seasons} fallbackThumb={item.banner} onPlay={playEpisode} />
        ) : catalog.loading ? (
          <div className="grid grid-cols-3 gap-2.5 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer aspect-[.65] rounded-md" />
            ))}
          </div>
        ) : more.length ? (
          <div className="grid grid-cols-3 gap-2.5 p-4">
            {more.map((it) => (
              <Link key={it.id} to={detailPath(it)} className="relative block" aria-label={it.title}>
                {!it.isFree && <LockBadge />}
                <Img src={it.poster} alt={it.title} className="aspect-[.65] w-full rounded-md" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-white/50">Nothing to show yet.</p>
        )}
      </div>

      <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
      <ComingSoonDialog open={comingSoon} label={label} onClose={() => setComingSoon(false)} />
    </AppShell>
  );
}
