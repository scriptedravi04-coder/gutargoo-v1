// EPISODES tab: season text tabs, episode rows (first 5, then View More / View Less).
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Play } from "lucide-react";
import { Img } from "@v/components/Img";
import type { ApiEpisode, ApiSeason } from "@v/lib/api";
import { episodeUrl } from "@v/lib/content";

const FIRST = 5;

export const episodeThumb = (e: ApiEpisode, fallback: string) => e.thumbnail || e.videoFile?.thumbnailUrl || fallback;

function EpisodeRow({ ep, fallbackThumb, onPlay }: { ep: ApiEpisode; fallbackThumb: string; onPlay: (ep: ApiEpisode) => void }) {
  const available = !!episodeUrl(ep);
  const body = (
    <>
      <div className="relative h-20 w-[130px] shrink-0 overflow-hidden rounded-md">
        <Img src={episodeThumb(ep, fallbackThumb)} alt={ep.title} className="h-full w-full" />
        {available ? (
          <span className="absolute bottom-1.5 left-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55">
            <Play className="h-3 w-3" fill="currentColor" />
          </span>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-bold text-orange">Coming Soon</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{ep.title}</p>
        {ep.description && <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-white/60">{ep.description}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-white/55">Episode {ep.episodeNumber}</span>
          {!available && <span className="rounded bg-orange/15 px-1.5 py-0.5 text-[9px] font-semibold text-orange">Coming Soon</span>}
        </div>
      </div>
    </>
  );
  const cls = "mx-3 my-0.5 flex w-[calc(100%-1.5rem)] gap-3 border-b border-white/10 py-2.5 text-left";
  return available ? (
    <button type="button" onClick={() => onPlay(ep)} className={clsx(cls, "hover:bg-white/[.03]")}>
      {body}
    </button>
  ) : (
    <div className={clsx(cls, "opacity-80")} aria-disabled="true">
      {body}
    </div>
  );
}

export function EpisodeList({ seasons, fallbackThumb, onPlay }: { seasons: ApiSeason[]; fallbackThumb: string; onPlay: (ep: ApiEpisode) => void }) {
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [seasonIdx]);

  if (!seasons.length) return <p className="px-5 py-10 text-center text-sm text-white/50">Episodes are coming soon.</p>;

  const season = seasons[Math.min(seasonIdx, seasons.length - 1)];
  const episodes = [...(season.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const shown = showAll ? episodes : episodes.slice(0, FIRST);

  return (
    <div>
      <div className="no-scrollbar flex gap-6 overflow-x-auto px-4 pt-3" role="tablist" aria-label="Seasons">
        {seasons.map((s, i) => {
          const sel = i === seasonIdx;
          return (
            <button
              key={s._id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setSeasonIdx(i)}
              className={clsx("shrink-0 whitespace-nowrap border-b-[2.5px] pb-1.5 text-[15px]", sel ? "border-white font-bold text-white" : "border-transparent text-white/40")}
            >
              Season {s.seasonNumber}
            </button>
          );
        })}
      </div>
      <div className="pt-2">
        {shown.map((ep) => (
          <EpisodeRow key={ep._id} ep={ep} fallbackThumb={fallbackThumb} onPlay={onPlay} />
        ))}
        {!episodes.length && <p className="px-5 py-8 text-center text-sm text-white/50">Episodes are coming soon.</p>}
      </div>
      {episodes.length > FIRST && (
        <div className="flex justify-center py-4">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="rounded-[20px] bg-white/10 px-5 py-2 text-xs font-semibold">
            {showAll ? "View Less" : `View More (${episodes.length - FIRST})`}
          </button>
        </div>
      )}
    </div>
  );
}
