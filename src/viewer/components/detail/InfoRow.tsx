// Logo (or title) + centred info row: IMDB x.x • genres • N Seasons • age rating
import { Fragment, useState } from "react";
import type { Item } from "@v/lib/content";

export function TitleLogo({ item }: { item: Item }) {
  const [failed, setFailed] = useState(false);
  if (item.logo && !failed) {
    return (
      <div className="flex justify-center px-4 pt-5">
        <img src={item.logo} alt={item.title} className="h-[50px] w-[160px] object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  return <h1 className="break-words px-4 pt-5 text-center text-[22px] font-bold leading-tight">{item.title}</h1>;
}

export function InfoRow({ item }: { item: Item }) {
  const parts: { key: string; node: JSX.Element }[] = [];
  if (item.imdb > 0)
    parts.push({ key: "imdb", node: <span className="text-[13px] font-extrabold text-imdb">IMDB {item.imdb.toFixed(1)}</span> });
  if (item.genres.length) parts.push({ key: "genres", node: <span className="text-xs text-[#B0B0B0]">{item.genres.slice(0, 3).join(", ")}</span> });
  if (item.kind !== "movie" && item.seasons.length)
    parts.push({
      key: "seasons",
      node: (
        <span className="text-xs text-[#B0B0B0]">
          {item.seasons.length} {item.seasons.length === 1 ? "Season" : "Seasons"}
        </span>
      ),
    });
  if (item.age) parts.push({ key: "age", node: <span className="text-xs text-[#B0B0B0]">{item.age}</span> });
  if (!parts.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pt-2">
      {parts.map((p, i) => (
        <Fragment key={p.key}>
          {i > 0 && <span className="h-1 w-1 rounded-full bg-[#9E9E9E]" aria-hidden="true" />}
          {p.node}
        </Fragment>
      ))}
    </div>
  );
}

export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 100;
  return (
    <div className="mx-4 mt-4">
      <p className={`whitespace-pre-line text-[13px] leading-[1.55] text-[#BDBDBD] ${!open && long ? "line-clamp-3" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="-ml-1 mt-0.5 px-1 py-1.5 text-[13px] font-semibold text-link">
          {open ? "Read Less" : "Read More"}
        </button>
      )}
    </div>
  );
}
