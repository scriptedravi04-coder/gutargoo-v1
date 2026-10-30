// Movie details (app's details_screen): trailer on top, logo, info, Play, description, actions, cast, Explore More.
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCatalog } from "@v/hooks/useCatalog";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { DesktopDetail } from "@v/components/desktop/DesktopDetail";
import { AppShell } from "@v/components/AppShell";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { TrailerHero, TrailerHeroHandle } from "@v/components/detail/TrailerHero";
import { Description, InfoRow, TitleLogo } from "@v/components/detail/InfoRow";
import { ActionPills } from "@v/components/detail/ActionPills";
import { CastRow } from "@v/components/detail/CastRow";
import { PosterRow } from "@v/components/detail/PosterRow";
import { ComingSoonDialog } from "@v/components/detail/ComingSoonDialog";
import { useMovieQuery } from "@v/components/detail/queries";
import { DetailError, DetailSkeleton, isNotFound, PlayButton } from "@v/components/detail/DetailParts";

export default function MovieDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const heroRef = useRef<TrailerHeroHandle>(null);
  const [appOnly, setAppOnly] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [trailerOk, setTrailerOk] = useState(true);
  const desktop = useIsDesktop();

  const q = useMovieQuery(id);
  const catalog = useCatalog();

  const item = q.data;
  const explore = useMemo(() => catalog.everything.filter((x) => x.id !== id), [catalog.everything, id]);

  if (q.isLoading) return <DetailSkeleton />;
  if (q.error || !item) return <DetailError notFound={isNotFound(q.error)} onRetry={() => q.refetch()} />;

  const play = () => {
    if (!item.isFree) setAppOnly(true);
    else if (!item.playUrl) setComingSoon(true);
    else navigate(`/watch/movie/${item.id}`);
  };

  const sheets = (
    <>
      <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
      <ComingSoonDialog open={comingSoon} label="Movie" onClose={() => setComingSoon(false)} />
    </>
  );

  if (desktop) {
    return (
      <AppShell wide overlay>
        <DesktopDetail key={item.id} item={item} onPlay={play} more={explore} moreTitle="More Like This" moreLoading={catalog.loading} />
        {sheets}
      </AppShell>
    );
  }

  return (
    <AppShell nav={false}>
      <div className="sticky-top-portrait relative z-30 bg-black">
        <TrailerHero key={item.id} ref={heroRef} item={item} onPlay={play} onAvailable={setTrailerOk} />
      </div>
      <TitleLogo item={item} />
      <InfoRow item={item} />
      <PlayButton onClick={play} />
      <Description text={item.description} />
      <ActionPills key={item.id} item={item} onTrailer={item.trailerUrl && trailerOk ? () => heroRef.current?.openFullscreen() : undefined} />
      <CastRow people={item.people} />
      <PosterRow title="Explore More" items={explore} loading={catalog.loading} />

      <AppOnlySheet open={appOnly} title={item.title} onClose={() => setAppOnly(false)} />
      <ComingSoonDialog open={comingSoon} label="Movie" onClose={() => setComingSoon(false)} />
    </AppShell>
  );
}
