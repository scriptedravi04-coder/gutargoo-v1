import { useMemo, useState } from "react";
import { storage } from "@v/lib/storage";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api, ApiMovie, errorMessage } from "@v/lib/api";
import { fromMovie, Item } from "@v/lib/content";
import { useAuth } from "@v/lib/auth";
import { useToast } from "@v/hooks/useToast";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { HScroll } from "./HScroll";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { useEscape } from "@v/hooks/useEscape";
import { RowHeader, Scroller } from "@v/components/desktop/Rows";
import clsx from "clsx";

interface CwRow {
  _id: string;
  movie: ApiMovie;
  watchedTime: number;
  duration: number;
}

interface CwEntry {
  id: string;
  item: Item;
  watchedTime: number;
  progress: number; // 0..1
  path: string; // where "resume" goes
  local?: boolean; // kept on this device (series / guests)
  label?: string; // "S1 E3"
}

// "CONTINUE WATCHING" (logged-in users, Home chip only)
export function ContinueWatchingRow() {
  const { token, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const showToast = useToast();
  const [confirm, setConfirm] = useState<CwEntry | null>(null);
  const [locked, setLocked] = useState<Item | null>(null);
  const key = ["continue-watching", token];
  const desktop = useIsDesktop();

  const { data } = useQuery({
    queryKey: key,
    enabled: isLoggedIn,
    queryFn: async () => {
      const res = await api.get<{ data: CwRow[] }>("/continue-watching");
      return (res.data?.data || [])
        .filter((r) => r && r.movie && r.movie._id)
        .map((r): CwEntry => {
          const item = fromMovie(r.movie);
          const total = r.duration || (item.durationMin ? item.durationMin * 60 : 0);
          const w = Math.max(0, Math.floor(r.watchedTime || 0));
          return {
            id: item.id,
            item,
            watchedTime: w,
            progress: total > 0 ? Math.min(1, Math.max(0, (r.watchedTime || 0) / total)) : 0,
            path: `/watch/movie/${item.id}?t=${w}`,
          };
        });
    },
  });

  const remove = useMutation({
    mutationFn: (movieId: string) => api.delete(`/continue-watching/${movieId}`),
    onSuccess: (_r, movieId) => {
      qc.setQueryData<CwEntry[]>(key, (old) => (old || []).filter((e) => e.id !== movieId));
    },
    onError: (err) => showToast(errorMessage(err, "Couldn't remove. Please try again.")),
  });

  const [localTick, setLocalTick] = useState(0);
  // series episodes (and movies for guests) remembered on this device
  const entries = useMemo(() => {
    const server = isLoggedIn ? data || [] : [];
    const have = new Set(server.map((e) => e.id));
    const local: CwEntry[] = storage
      .getLocalCw()
      .filter((l) => !have.has(l.id) && (l.kind !== "movie" || !isLoggedIn))
      .map((l) => ({
        id: l.id,
        item: { id: l.id, kind: l.kind, title: l.title, banner: l.banner, poster: l.banner, isFree: l.free } as Item,
        watchedTime: l.t,
        progress: l.d > 0 ? Math.min(1, l.t / l.d) : 0,
        path: l.kind === "movie" ? `/watch/movie/${l.id}?t=${l.t}` : `/watch/series/${l.id}?ep=${l.epId || ""}${l.t ? `&t=${l.t}` : ""}`,
        local: true,
        label: l.epLabel,
      }));
    return [...server, ...local];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoggedIn, localTick]);

  if (!entries.length) return null;

  const resume = (e: CwEntry) => {
    if (!e.item.isFree) return setLocked(e.item);
    navigate(e.path);
  };

  const cards = entries.map((e) => (
    <div
      key={e.id}
      className={clsx(
        "relative shrink-0 overflow-hidden",
        desktop ? "gp-card aspect-video w-[17rem] rounded-lg lg:w-[19rem] xl:w-[21rem]" : "h-[110px] w-[180px] rounded-xl"
      )}
    >
      <button type="button" onClick={() => resume(e)} className="absolute inset-0 text-left" aria-label={`Resume ${e.item.title}`}>
        <Img src={e.item.banner} alt={e.item.title} className="h-full w-full" />
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.3),transparent_50%,rgba(0,0,0,.6))]" />
        {!e.item.isFree && <LockBadge />}
        {desktop && (
          <span className="pointer-events-none absolute bottom-3 left-3 right-12 truncate text-sm font-semibold">
            {e.item.title}
            {e.label && <span className="ml-2 text-white/60">{e.label}</span>}
          </span>
        )}
        {!desktop && e.label && <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold">{e.label}</span>}
      </button>
      <button
        type="button"
        onClick={() => setConfirm(e)}
        aria-label={`Remove ${e.item.title} from Continue Watching`}
        className="absolute right-1.5 top-1.5 z-10 rounded-full border border-white/20 bg-black/70 p-1.5 hover:bg-black"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/50">
        <div className="h-full bg-red-600" style={{ width: `${e.progress * 100}%` }} />
      </div>
    </div>
  ));

  return (
    <section className="mb-5">
      {desktop ? (
        <>
          <RowHeader title="Continue Watching" />
          <Scroller>{cards}</Scroller>
        </>
      ) : (
        <>
          <h2 className="px-4 py-[5px] text-base font-bold uppercase">Continue Watching</h2>
          <div className="mt-1.5">
            <HScroll className="gap-2.5 px-4">{cards}</HScroll>
          </div>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title="Remove from Continue Watching?"
          message={confirm.item.title}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.local) {
              storage.removeLocalCw(confirm.id);
              setLocalTick((n) => n + 1);
            } else remove.mutate(confirm.id);
            setConfirm(null);
          }}
        />
      )}
      <AppOnlySheet open={!!locked} title={locked?.title} onClose={() => setLocked(null)} />
    </section>
  );
}

function ConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message?: string; onCancel: () => void; onConfirm: () => void }) {
  useEscape(true, onCancel);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-[340px] rounded-2xl bg-tile p-5"
      >
        <h3 className="text-base font-bold">{title}</h3>
        {message && <p className="mt-1.5 line-clamp-2 text-sm text-white/60">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-white/25 py-2.5 text-sm font-semibold hover:bg-white/5">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} autoFocus className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold hover:bg-red-500">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
