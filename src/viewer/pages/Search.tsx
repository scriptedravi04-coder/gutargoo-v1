import { useGoBack } from "@v/hooks/useGoBack";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, History, Info, Mic, Play, Plus, Search as SearchIcon, X } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@v/components/AppShell";
import { Img } from "@v/components/Img";
import { LockBadge } from "@v/components/LockBadge";
import { AppOnlySheet } from "@v/components/AppOnlySheet";
import { ErrorState } from "@v/components/States";
import { useCatalog } from "@v/hooks/useCatalog";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useToast } from "@v/hooks/useToast";
import { storage } from "@v/lib/storage";
import { detailPath, Item } from "@v/lib/content";

const HINT_WORDS = ["Web Series...", "Movies..."];

// "Search " + typewriter cycling the words (80 ms per character, 1.2 s pause)
function useTypewriter(words: string[]) {
  const [text, setText] = useState("");
  useEffect(() => {
    let w = 0;
    let c = 0;
    let timer: number;
    const tick = () => {
      const word = words[w];
      if (c < word.length) {
        c += 1;
        setText(word.slice(0, c));
        timer = window.setTimeout(tick, 80);
      } else {
        timer = window.setTimeout(() => {
          w = (w + 1) % words.length;
          c = 0;
          setText("");
          tick();
        }, 1200);
      }
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [words]);
  return text;
}

// Browser speech recognition (Chrome/Edge/Safari). Not available → no mic button.
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
const getRecognitionCtor = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

function search(items: Item[], q: string): Item[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const byTitle: Item[] = [];
  const byGenre: Item[] = [];
  const byDesc: Item[] = [];
  for (const it of items) {
    if (it.title.toLowerCase().includes(s)) byTitle.push(it);
    else if (it.genres.some((g) => g.toLowerCase().includes(s))) byGenre.push(it);
    else if (it.description.toLowerCase().includes(s)) byDesc.push(it);
  }
  return [...byTitle, ...byGenre, ...byDesc];
}

function RoundButton({ label, onClick, solid, children }: { label: string; onClick: () => void; solid?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1" aria-label={label}>
      <span
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-full",
          solid ? "bg-white text-black" : "border border-white/[.24] text-white hover:bg-white/10"
        )}
      >
        {children}
      </span>
      <span className="text-[10px] text-white/70">{label}</span>
    </button>
  );
}

export default function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [debounced, setDebounced] = useState(query);
  const [recents, setRecents] = useState<string[]>(storage.getRecentSearches());
  const [listening, setListening] = useState(false);
  const [locked, setLocked] = useState<Item | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hint = useTypewriter(HINT_WORDS);
  const { everything, loading, error, refetch } = useCatalog();
  const { has, toggle } = useWatchlist();
  const toast = useToast();
  const RecognitionCtor = useMemo(getRecognitionCtor, []);

  // debounce 300 ms, keep ?q= in the URL
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  useEffect(() => {
    const q = debounced.trim();
    if ((params.get("q") || "") !== q) setParams(q ? { q } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => () => recRef.current?.stop(), []);

  const results = useMemo(() => search(everything, debounced), [everything, debounced]);

  const saveRecent = (q: string) => {
    const s = q.trim();
    if (!s) return;
    const next = [s, ...storage.getRecentSearches().filter((x) => x.toLowerCase() !== s.toLowerCase())].slice(0, 10);
    storage.setRecentSearches(next);
    setRecents(next);
  };
  const removeRecent = (q: string) => {
    const next = recents.filter((x) => x !== q);
    storage.setRecentSearches(next);
    setRecents(next);
  };
  const clearRecents = () => {
    storage.setRecentSearches([]);
    setRecents([]);
  };

  const openDetail = (it: Item) => {
    saveRecent(query);
    navigate(detailPath(it));
  };
  const play = (it: Item) => {
    saveRecent(query);
    if (!it.isFree) return setLocked(it);
    navigate(it.playUrl ? (it.kind === "movie" ? `/watch/movie/${it.id}` : `/watch/series/${it.id}`) : detailPath(it));
  };
  const save = (it: Item) => {
    const added = toggle(it);
    toast(added ? "Added to My List" : "Removed from My List");
  };

  const toggleVoice = () => {
    if (!RecognitionCtor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new RecognitionCtor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = String(e?.results?.[0]?.[0]?.transcript || "").trim();
      if (text) {
        setQuery(text);
        setDebounced(text);
        saveRecent(text);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const back = useGoBack();
  const q = debounced.trim();

  return (
    <AppShell wide>
      <div className="px-[14px] pb-6 pt-[50px] md:min-h-[70vh] md:px-[4%] md:pt-10">
        {/* search bar */}
        <div className="flex items-center gap-2.5 md:mx-auto md:max-w-3xl">
          <button type="button" onClick={back} aria-label="Back" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#212121] md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <form
            role="search"
            className="relative flex h-[50px] flex-1 items-center rounded-xl bg-[#212121] md:h-14 md:rounded-2xl md:border md:border-white/10"
            onSubmit={(e) => {
              e.preventDefault();
              setDebounced(query);
              saveRecent(query);
              inputRef.current?.blur();
            }}
          >
            <SearchIcon className="ml-3.5 h-[18px] w-[18px] shrink-0 text-white/[.54]" />
            <div className="relative h-full flex-1">
              {!query && (
                <span className="pointer-events-none absolute inset-0 flex items-center px-2.5 text-[15px] text-[#8E8E8E]" aria-hidden="true">
                  Search {hint}
                </span>
              )}
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search web series and movies"
                enterKeyHint="search"
                autoComplete="off"
                className="h-full w-full bg-transparent px-2.5 text-[15px] text-white outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setDebounced("");
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="mr-2 flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            ) : RecognitionCtor ? (
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop voice search" : "Voice search"}
                aria-pressed={listening}
                className={clsx("mr-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10", listening ? "animate-pulse text-red-500" : "text-white/70")}
              >
                <Mic className="h-5 w-5" />
              </button>
            ) : null}
          </form>
        </div>
        {listening && <p className="mt-2 text-center text-xs text-red-400">Listening… speak now</p>}

        {error && !everything.length ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !q ? (
          <>
            {recents.length > 0 && (
              <section className="mt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-white/70">Recent Searches</h2>
                  <button type="button" onClick={clearRecents} className="text-[13px] font-semibold text-orange">
                    Clear All
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recents.map((r) => (
                    <div key={r} className="flex items-center gap-1.5 rounded-[20px] border border-white/[.12] bg-[#212121] py-1.5 pl-3 pr-1.5 text-[13px]">
                      <History className="h-3.5 w-3.5 text-white/60" />
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(r);
                          setDebounced(r);
                        }}
                        className="max-w-[180px] truncate text-white/90"
                      >
                        {r}
                      </button>
                      <button type="button" onClick={() => removeRecent(r)} aria-label={`Remove ${r}`} className="rounded-full p-0.5 text-white/50 hover:bg-white/10">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-5 h-px bg-white/10" />
              </section>
            )}

            <section className="mt-6">
              <h2 className="mb-3 text-[16px] font-bold md:mb-5 md:text-[1.3rem]">Browse All</h2>
              <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4 md:gap-x-5 md:gap-y-6 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {loading
                  ? Array.from({ length: 9 }, (_, i) => <div key={i} className="shimmer aspect-[.65] rounded-lg" />)
                  : everything.map((it) => (
                      <Link key={it.id} to={detailPath(it)} className="gp-card relative block rounded-lg" aria-label={it.title}>
                        {!it.isFree && <LockBadge />}
                        <Img src={it.poster} alt={it.title} className="aspect-[.65] rounded-lg md:aspect-[2/3]" />
                      </Link>
                    ))}
              </div>
            </section>
          </>
        ) : loading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-xl bg-[#1A1A1A]">
                <div className="shimmer h-[200px]" />
                <div className="space-y-2 p-3">
                  <div className="shimmer h-4 w-1/2 rounded" />
                  <div className="shimmer h-3 w-full rounded" />
                  <div className="shimmer h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="mt-20 whitespace-pre-line text-center text-[15px] text-white/60">{`No results found for\n"${q}"`}</p>
        ) : (
          <div className="mt-6 space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-3 2xl:grid-cols-4">
            {results.map((it) => (
              <article key={it.id} className="overflow-hidden rounded-xl bg-[#1A1A1A]">
                <button type="button" onClick={() => openDetail(it)} className="relative block w-full" aria-label={`Open ${it.title}`}>
                  {!it.isFree && <LockBadge />}
                  <Img src={it.banner} alt={it.title} className="h-[200px] w-full md:aspect-video md:h-auto" />
                </button>
                <div className="p-3">
                  <div className="flex items-start gap-3">
                    <h3 className="line-clamp-2 flex-1 pt-1 text-[16px] font-bold">{it.title}</h3>
                    <div className="flex shrink-0 gap-3">
                      <RoundButton label="My List" onClick={() => save(it)}>
                        {has(it.id) ? <CircleCheck className="h-[18px] w-[18px] text-orange" /> : <Plus className="h-[18px] w-[18px]" />}
                      </RoundButton>
                      <RoundButton label="Detail" onClick={() => openDetail(it)}>
                        <Info className="h-[18px] w-[18px]" />
                      </RoundButton>
                      <RoundButton label="Play" solid onClick={() => play(it)}>
                        <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" />
                      </RoundButton>
                    </div>
                  </div>
                  {it.description && <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-white/70">{it.description}</p>}
                  {it.genres.length > 0 && <p className="mt-1.5 text-[11px] text-white/[.38]">{it.genres.join(" • ")}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <AppOnlySheet open={!!locked} title={locked?.title} onClose={() => setLocked(null)} />
    </AppShell>
  );
}
