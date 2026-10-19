// Trailer · Like · My List · Share pills (white/5 fill, white24 border; active = red).
import { ReactNode, useEffect, useState } from "react";
import clsx from "clsx";
import { CircleCheck, Clapperboard, Plus, Share2, ThumbsUp } from "lucide-react";
import { storage } from "@v/lib/storage";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useToast } from "@v/hooks/useToast";
import type { Item } from "@v/lib/content";
import { api } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";

function Pill({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "flex h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border-[0.9px] px-1.5 text-[12.5px] font-medium transition-colors [&>svg]:shrink-0",
        active ? "border-[#E50914] bg-[#E50914]/20 text-[#E50914]" : "border-white/25 bg-white/5 text-white"
      )}
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Like / My List / Share for one title (used by the phone pills and the big-screen buttons).
 *  Like: movies + signed in → saved on the server (same as the app); otherwise on this device. */
export function useItemActions(item: Item) {
  const { has, toggle } = useWatchlist();
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const [liked, setLiked] = useState(() => storage.getLikes().includes(item.id));
  const inList = has(item.id);
  const serverLike = isLoggedIn && item.kind === "movie";

  useEffect(() => {
    if (!serverLike) return;
    let alive = true;
    api
      .get<{ liked?: boolean }>(`/movie-likes/${item.id}/check`)
      .then((r) => alive && typeof r.data?.liked === "boolean" && setLiked(r.data.liked))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [serverLike, item.id]);

  const saveLocal = (on: boolean) => {
    const cur = storage.getLikes().filter((x) => x !== item.id);
    storage.setLikes(on ? [...cur, item.id] : cur);
  };

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    saveLocal(next);
    if (serverLike) {
      api
        .post<{ liked?: boolean }>(`/movie-likes/${item.id}`)
        .then((r) => {
          if (typeof r.data?.liked === "boolean") {
            setLiked(r.data.liked);
            saveLocal(r.data.liked);
          }
        })
        .catch(() => {
          setLiked(!next);
          saveLocal(!next);
          toast("Couldn't save your like. Please try again.");
        });
    }
  };

  const toggleList = () => toast(toggle(item) ? "Added to My List" : "Removed from My List");

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, text: `Watch ${item.title} on Gutargoo+`, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy the link");
    }
  };

  return { liked, toggleLike, inList, toggleList, share };
}

export function ActionPills({ item, onTrailer }: { item: Item; onTrailer?: () => void }) {
  const { liked, toggleLike, inList, toggleList, share } = useItemActions(item);

  return (
    <div className={clsx("grid gap-2 px-4 pt-5", onTrailer ? "grid-cols-4" : "grid-cols-3")}>
      {onTrailer && (
        <Pill label="Trailer" onClick={onTrailer}>
          <Clapperboard className="h-4 w-4" />
        </Pill>
      )}
      <Pill label="Like" active={liked} onClick={toggleLike}>
        <ThumbsUp className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
      </Pill>
      <Pill label="My List" active={inList} onClick={toggleList}>
        {inList ? <CircleCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </Pill>
      <Pill label="Share" onClick={share}>
        <Share2 className="h-4 w-4" />
      </Pill>
    </div>
  );
}
