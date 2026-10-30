// What the main button of a title does, and exactly what it says (notes 03 / 04).
import { episodeUrl, Item, seriesPlayTarget } from "@v/lib/content";
import type { CwCard } from "./useContinue";
import { leftText } from "./ui";
import { isPro } from "./pro";

export interface PlayTarget {
  label: string; // long label (Detail CTA)
  short: string; // hero card / feed
  path: string | null; // null → nothing playable yet
  locked: boolean;
  resume: boolean;
  pct: number;
}

export function playTarget(it: Item, cards: CwCard[]): PlayTarget {
  const card = cards.find((c) => c.id === it.id) || null;
  if (!it.isFree && !isPro()) return { label: "Unlock with Premium", short: "Unlock with Premium", path: "/plans", locked: true, resume: false, pct: 0 };
  if (it.kind === "movie") {
    if (card && card.leftSec > 30) {
      const l = `Resume · ${leftText(card.leftSec)}`;
      return { label: l, short: l, path: card.path, locked: false, resume: true, pct: card.pct };
    }
    return { label: "Play", short: "Play", path: it.playUrl ? `/watch/movie/${it.id}` : null, locked: false, resume: false, pct: 0 };
  }
  // series: resume the episode this device was watching, else the first playable one
  if (card && card.badge) {
    const l = `Resume ${card.badge}`;
    return { label: card.leftSec > 30 ? `${l} · ${leftText(card.leftSec)}` : l, short: l, path: card.path, locked: false, resume: true, pct: card.pct };
  }
  const t = seriesPlayTarget(it);
  if (!t.ep || !episodeUrl(t.ep)) return { label: "Play S1 E1", short: "Play S1 E1", path: null, locked: false, resume: false, pct: 0 };
  const season = it.seasons.find((s) => (s.episodes || []).some((e) => e._id === t.ep!._id))?.seasonNumber || 1;
  const l = t.resume ? t.label : `Play S${season} E${t.ep.episodeNumber}`;
  return { label: l, short: l, path: `/watch/series/${it.id}?ep=${t.ep._id}`, locked: false, resume: t.resume, pct: 0 };
}

/** "Because you watched": score = 3 × shared genres + 1 if same type + rating ÷ 10 */
export function similarTo(it: Item, all: Item[], limit = 15): Item[] {
  const g = new Set(it.genres.map((x) => x.toLowerCase()));
  const series = it.kind !== "movie";
  return all
    .filter((x) => x.id !== it.id)
    .map((x) => ({ x, s: x.genres.filter((y) => g.has(y.toLowerCase())).length * 3 + ((x.kind !== "movie") === series ? 1 : 0) + (x.imdb || 0) / 10 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.x);
}
