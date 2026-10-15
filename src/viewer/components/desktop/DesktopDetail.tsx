// Big-screen details page for a movie / web series / TV show.
import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Clapperboard, CircleCheck, Play, Plus, Share2, ThumbsUp, X } from "lucide-react";
import type { ApiEpisode, ApiSeason } from "@v/lib/api";
import { episodeUrl, Item, kindLabel } from "@v/lib/content";
import { Img } from "@v/components/Img";
import { useItemActions } from "@v/components/detail/ActionPills";
import { episodeThumb } from "@v/components/detail/EpisodeList";
import { useHls } from "@v/components/player/useHls";
import { MetaLine } from "./DesktopHero";
import { GridShimmer, PosterGrid } from "./Rows";

function IconAction({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="group flex flex-col items-center gap-1.5 rounded-lg px-2 py-1">
      <span
        className={clsx(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 transition",
          active ? "border-orange bg-orange/15 text-orange" : "border-white/40 bg-black/30 group-hover:border-white"
        )}
      >
        {children}
      </span>
      <span className="text-xs text-white/75">{label}</span>
    </button>
  );
}

/** Trailer with sound in a centred window */
function TrailerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { error } = useHls(ref, src, { autoPlay: true });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-[4%]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${title} trailer`} className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close trailer" className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-6 w-6" />
        </button>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
          <video ref={ref} className="h-full w-full" controls playsInline autoPlay controlsList="nodownload" />
          {error && <p className="absolute inset-0 flex items-center justify-center text-white/70">Trailer not available</p>}
        </div>
      </div>
    </div>
  );
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 260;
  return (
    <div className="mt-5 max-w-[44rem]">
      <p className={clsx("whitespace-pre-line text-[1.02rem] leading-relaxed text-white/80", !open && long && "line-clamp-4")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-semibold text-orange">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function People({ item }: { item: Item }) {
  if (!item.people.length) return null;
  return (
    <section className="mt-12 px-[4%]">
      <h2 className="mb-4 text-[1.3rem] font-bold">Cast &amp; Crew</h2>
      <div className="no-scrollbar flex gap-6 overflow-x-auto pb-2">
        {item.people.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex w-[6.5rem] shrink-0 flex-col items-center text-center">
            {p.image ? (
              <Img src={p.image} alt={p.name} className="h-[5.5rem] w-[5.5rem] rounded-full" />
            ) : (
              <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-[#212121] text-xl font-bold text-white/70" aria-hidden="true">
                {p.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")}
              </div>
            )}
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{p.name}</p>
            {p.role && <p className="mt-0.5 line-clamp-1 text-xs text-white/50">{p.role}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DesktopEpisodes({ seasons, fallbackThumb, onPlay, currentId }: { seasons: ApiSeason[]; fallbackThumb: string; onPlay: (ep: ApiEpisode) => void; currentId?: string }) {
  const startIdx = Math.max(0, currentId ? seasons.findIndex((s) => s.episodes.some((e) => e._id === currentId)) : 0);
  const [seasonIdx, setSeasonIdx] = useState(startIdx);
  useEffect(() => setSeasonIdx(startIdx), [startIdx]);
  if (!seasons.length) return <p className="py-8 text-white/50">Episodes are coming soon.</p>;
  const season = seasons[Math.min(seasonIdx, seasons.length - 1)];
  const episodes = [...(season.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  return (
    <div>
      {seasons.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Seasons">
          {seasons.map((s, i) => (
            <button
              key={s._id}
              type="button"
              role="tab"
              aria-selected={i === seasonIdx}
              onClick={() => setSeasonIdx(i)}
              className={clsx("rounded-full px-4 py-2 text-sm font-semibold transition", i === seasonIdx ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20")}
            >
              Season {s.seasonNumber}
            </button>
          ))}
        </div>
      )}
      {!episodes.length && <p className="py-8 text-white/50">Episodes are coming soon.</p>}
      <div className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-3 2xl:grid-cols-4">
        {episodes.map((ep) => {
          const available = !!episodeUrl(ep);
          const playing = ep._id === currentId;
          return (
            <button
              key={ep._id}
              type="button"
              onClick={() => onPlay(ep)}
              className={clsx("gp-card group block rounded-lg text-left", !available && "opacity-80")}
              aria-label={`Episode ${ep.episodeNumber}: ${ep.title}${available ? "" : " (coming soon)"}`}
            >
              <div className={clsx("relative overflow-hidden rounded-lg", playing && "ring-2 ring-orange")}>
                <Img src={episodeThumb(ep, fallbackThumb)} alt={ep.title} className="aspect-video w-full" />
                {available ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40 group-focus-visible:bg-black/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Play className="h-5 w-5" fill="currentColor" />
                    </span>
                  </span>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-orange">Coming Soon</span>
                )}
                {playing && <span className="absolute left-2 top-2 rounded bg-orange px-2 py-0.5 text-[0.65rem] font-bold">NOW PLAYING</span>}
              </div>
              <p className="mt-2.5 line-clamp-1 font-semibold">
                <span className="text-white/50">E{ep.episodeNumber} · </span>
                {ep.title}
              </p>
              {ep.description && <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/55">{ep.description}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DesktopDetail({
  item,
  onPlay,
  more,
  moreTitle,
  moreLoading,
  onPlayEpisode,
}: {
  item: Item;
  onPlay: () => void;
  more: Item[];
  moreTitle: string;
  moreLoading: boolean;
  onPlayEpisode?: (ep: ApiEpisode) => void;
}) {
  const { liked, toggleLike, inList, toggleList, share } = useItemActions(item);
  const [trailer, setTrailer] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const isSeries = item.kind !== "movie";

  return (
    <>
      <section className="relative flex min-h-[min(88vh,52rem)] flex-col justify-end">
        <div className="absolute inset-x-0 top-0 h-[min(88vh,52rem)] overflow-hidden">
          <Img src={item.banner} alt="" className="h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.92)_0%,rgba(0,0,0,.6)_40%,rgba(0,0,0,.1)_75%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        </div>

        {/* title block sits at the bottom of the picture, right above Episodes */}
        <div className="relative px-[4%] pb-8 pt-28">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-orange">{kindLabel(item.kind)}</p>
          {item.logo && !logoFailed ? (
            <img src={item.logo} alt={item.title} onError={() => setLogoFailed(true)} className="mb-5 max-h-[8rem] max-w-[28rem] object-contain object-left" />
          ) : (
            <h1 className="mb-4 max-w-[48rem] font-black leading-[1.03] tracking-tight" style={{ fontSize: "clamp(2.25rem, 4vw, 3.75rem)" }}>
              {item.title}
            </h1>
          )}
          <MetaLine item={item} />
          <Description text={item.description} />

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-tv-start
              onClick={onPlay}
              className="flex items-center gap-2.5 rounded-lg bg-gradient-to-b from-[#DF4119] to-[#9E1119] px-10 py-3.5 text-lg font-bold shadow-[0_8px_30px_rgba(223,65,25,.35)] transition hover:brightness-110"
            >
              <Play className="h-6 w-6" fill="currentColor" />
              {item.isFree ? (isSeries ? "Play Episode 1" : "Play") : "Watch in App"}
            </button>
            {item.trailerUrl && (
              <button type="button" onClick={() => setTrailer(true)} className="flex items-center gap-2.5 rounded-lg bg-white/15 px-7 py-3.5 text-lg font-semibold backdrop-blur transition hover:bg-white/25">
                <Clapperboard className="h-6 w-6" /> Trailer
              </button>
            )}
            <div className="ml-2 flex items-center gap-2">
              <IconAction label="My List" active={inList} onClick={toggleList}>
                {inList ? <CircleCheck className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </IconAction>
              <IconAction label="Like" active={liked} onClick={toggleLike}>
                <ThumbsUp className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
              </IconAction>
              <IconAction label="Share" onClick={share}>
                <Share2 className="h-5 w-5" />
              </IconAction>
            </div>
          </div>
        </div>
      </section>

      {isSeries && onPlayEpisode && (
        <section className="mt-4 px-[4%]">
          <h2 className="mb-4 text-[1.3rem] font-bold">Episodes</h2>
          <DesktopEpisodes seasons={item.seasons} fallbackThumb={item.banner} onPlay={onPlayEpisode} />
        </section>
      )}

      <People item={item} />

      {(moreLoading || more.length > 0) && (
        <section className="mt-12 px-[4%]">
          <h2 className="mb-4 text-[1.3rem] font-bold">{moreTitle}</h2>
          {moreLoading ? <GridShimmer count={7} /> : <PosterGrid items={more.slice(0, 21)} />}
        </section>
      )}

      {trailer && item.trailerUrl && <TrailerModal src={item.trailerUrl} title={item.title} onClose={() => setTrailer(false)} />}
    </>
  );
}

export function DesktopDetailSkeleton() {
  return (
    <div className="px-[4%] pt-[max(9rem,24vh)]">
      <div className="shimmer h-4 w-24 rounded" />
      <div className="shimmer mt-4 h-14 w-[28rem] rounded" />
      <div className="shimmer mt-5 h-4 w-80 rounded" />
      <div className="mt-6 space-y-2">
        <div className="shimmer h-3 w-[40rem] rounded" />
        <div className="shimmer h-3 w-[36rem] rounded" />
      </div>
      <div className="shimmer mt-8 h-14 w-52 rounded-lg" />
    </div>
  );
}
