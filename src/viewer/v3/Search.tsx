// v3 Search (notes 06): a tab (no Back). Clear ✕ while typing, mic when empty. Empty query: recents, genres, trending.
// Live results (250 ms debounce) with poster, type · genres · year, Premium tag and an inline save button.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, BookmarkCheck, BookmarkPlus, Crown, Mic, Search as SearchIcon, SearchX, X } from "lucide-react";
import { useCatalog } from "@v/hooks/useCatalog";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { storage } from "@v/lib/storage";
import type { Item } from "@v/lib/content";
import { EASE, kindLabel, Pic, RED, Shell, TOP, useOpenDetail, useV3Toast } from "./ui";

const GENRE_BG = ["#7c2d22", "#1f3a4d", "#6b4e12", "#5b2341", "#2d2d3a", "#1e3326", "#3b2a52", "#4a2b1a"];

function search(items: Item[], q: string): Item[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const byTitle: Item[] = [];
  const byGenre: Item[] = [];
  const byOther: Item[] = [];
  for (const it of items) {
    if (it.title.toLowerCase().includes(s)) byTitle.push(it);
    else if (it.genres.some((g) => g.toLowerCase().includes(s))) byGenre.push(it);
    else if (it.lang.toLowerCase() === s || it.description.toLowerCase().includes(s) || it.people.some((p) => p.name.toLowerCase().includes(s))) byOther.push(it);
  }
  return [...byTitle, ...byGenre, ...byOther];
}

type Recognition = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const getRec = (): (new () => Recognition) | null => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export default function SearchV3() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [deb, setDeb] = useState(q);
  const [recents, setRecents] = useState<string[]>(storage.getRecentSearches());
  const [focus, setFocus] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const { everything, loading } = useCatalog();
  const { has, toggle } = useWatchlist();
  const toast = useV3Toast();
  const openDetail = useOpenDetail();

  useEffect(() => {
    const t = window.setTimeout(() => setDeb(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const s = deb.trim();
    if ((params.get("q") || "") !== s) setParams(s ? { q: s } : {}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deb]);
  useEffect(() => () => recRef.current?.stop(), []);

  const results = useMemo(() => search(everything, deb), [everything, deb]);
  const has_q = !!q.trim();

  const saveRecent = (s: string) => {
    const v = s.trim();
    if (!v) return;
    const next = [v, ...storage.getRecentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    storage.setRecentSearches(next);
    setRecents(next);
  };
  const use = (s: string) => {
    setQ(s);
    setDeb(s);
    saveRecent(s);
  };

  const genres = useMemo(() => {
    const count = new Map<string, { n: number; poster: string }>();
    for (const it of everything)
      for (const g of it.genres) {
        const k = g.trim();
        if (!k) continue;
        const c = count.get(k) || { n: 0, poster: "" };
        c.n++;
        if (!c.poster && it.poster) c.poster = it.poster;
        count.set(k, c);
      }
    return [...count.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([name, c], i) => ({ name, poster: c.poster, bg: GENRE_BG[i % GENRE_BG.length] }));
  }, [everything]);
  const trending = useMemo(() => [...everything].sort((a, b) => b.views - a.views).slice(0, 5), [everything]);

  const voice = () => {
    const Ctor = getRec();
    if (!Ctor) return toast("Voice search isn't supported in this browser");
    if (listening) return recRef.current?.stop();
    const r = new Ctor();
    r.lang = "hi-IN";
    r.interimResults = false;
    r.onresult = (e) => {
      const text = String(e.results?.[0]?.[0]?.transcript || "").trim();
      if (text) use(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      toast("Couldn't hear that. Try again.");
    };
    recRef.current = r;
    setListening(true);
    toast("Listening… say a title");
    r.start();
  };

  return (
    <Shell nav ambient>
      <div style={{ paddingBottom: 110, animation: `gpIn .45s ${EASE} both` }}>
        <div style={{ position: "sticky", top: 0, zIndex: 30, padding: `${TOP(54)} 18px 14px`, background: "rgba(0,0,0,.9)", WebkitBackdropFilter: "blur(26px) saturate(1.4)", backdropFilter: "blur(26px) saturate(1.4)" }}>
          <h1 style={{ margin: "0 0 14px", font: "800 30px/1 Outfit,sans-serif", letterSpacing: -0.4 }}>Search</h1>
          <label className="glass" style={{ display: "flex", height: 52, alignItems: "center", gap: 10, padding: "0 6px 0 16px", borderRadius: 16, border: `1px solid ${has_q || focus ? "rgba(239,65,48,.6)" : "rgba(255,255,255,.06)"}`, transition: "border-color .25s" }}>
            <span style={{ display: "flex", color: "rgba(245,245,245,.6)" }}>
              <SearchIcon size={20} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              onKeyDown={(e) => e.key === "Enter" && (saveRecent(q), (e.target as HTMLInputElement).blur())}
              placeholder="Movies, series, genres…"
              aria-label="Search"
              enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: 0, background: "transparent", color: "#F5F5F5", font: "500 16px/1 'DM Sans',sans-serif", boxShadow: "none" }}
            />
            {has_q ? (
              <button type="button" aria-label="Clear" onClick={() => setQ("")} style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, border: 0, background: "transparent", color: "rgba(245,245,245,.7)", animation: "gpFade .2s both" }}>
                <X size={18} />
              </button>
            ) : (
              <button type="button" aria-label="Voice search" onClick={voice} style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, border: 0, background: "transparent", color: listening ? RED : "rgba(245,245,245,.7)" }}>
                <Mic size={18} />
              </button>
            )}
          </label>
        </div>

        {!has_q ? (
          <div style={{ padding: "0 18px" }}>
            {recents.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                  <h3 style={{ margin: 0, font: "700 15px/1 Outfit,sans-serif" }}>Recent</h3>
                  <button
                    type="button"
                    onClick={() => {
                      storage.setRecentSearches([]);
                      setRecents([]);
                    }}
                    style={{ border: 0, background: "transparent", padding: "6px 0", font: "600 13px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recents.map((r) => (
                    <div key={r} className="glass" style={{ display: "flex", height: 36, alignItems: "center", gap: 2, padding: "0 4px 0 14px", borderRadius: 999, animation: "gpFade .3s both" }}>
                      <button type="button" onClick={() => use(r)} style={{ border: 0, background: "transparent", padding: 0, color: "#F5F5F5", font: "500 13px/1 'DM Sans',sans-serif" }}>
                        {r}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${r}`}
                        onClick={() => {
                          const next = recents.filter((x) => x !== r);
                          storage.setRecentSearches(next);
                          setRecents(next);
                        }}
                        style={{ display: "flex", height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "transparent", color: "rgba(245,245,245,.6)" }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {genres.length > 0 && (
              <>
                <h3 style={{ margin: "24px 0 12px", font: "700 15px/1 Outfit,sans-serif" }}>Browse by genre</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                  {genres.map((g, i) => (
                    <button key={g.name} type="button" onClick={() => use(g.name)} className="press" style={{ position: "relative", height: 92, overflow: "hidden", borderRadius: 16, border: 0, background: g.bg, textAlign: "left", padding: 14, color: "#fff", animation: `gpRise .5s ${i * 0.05}s both` }}>
                      <span style={{ position: "relative", zIndex: 1, font: "700 16px/1.1 Outfit,sans-serif" }}>{g.name}</span>
                      {g.poster && <img src={g.poster} alt="" loading="lazy" style={{ position: "absolute", right: -10, bottom: -14, width: 62, height: 88, objectFit: "cover", borderRadius: 8, transform: "rotate(14deg)", boxShadow: "-6px 6px 18px rgba(0,0,0,.4)" }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {trending.length > 0 && (
              <>
                <h3 style={{ margin: "26px 0 4px", font: "700 15px/1 Outfit,sans-serif" }}>Trending searches</h3>
                {trending.map((t, i) => (
                  <button key={t.id} type="button" onClick={() => use(t.title)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 14, padding: "12px 0", border: 0, borderBottom: "1px solid rgba(255,255,255,.06)", background: "transparent", color: "#F5F5F5", textAlign: "left" }}>
                    <span style={{ width: 18, font: "700 15px/1 Outfit,sans-serif", color: RED }}>{i + 1}</span>
                    <span style={{ flex: 1, font: "500 14px/1.2 'DM Sans',sans-serif" }}>{t.title}</span>
                    <span style={{ display: "flex", color: "rgba(245,245,245,.5)" }}>
                      <ArrowUpRight size={16} />
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        ) : (
          <div style={{ padding: "0 18px" }}>
            {deb.trim() === q.trim() && (
              <p style={{ margin: "4px 0 6px", font: "500 13px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>
                {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}
              </p>
            )}
            {results.map((it, i) => {
              const inL = has(it.id);
              return (
                <div
                  key={it.id}
                  onClick={() => {
                    saveRecent(q);
                    openDetail(it);
                  }}
                  role="link"
                  tabIndex={0}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", cursor: "pointer", animation: `gpRise .35s ${Math.min(i, 10) * 0.04}s both` }}
                >
                  <div style={{ position: "relative", width: 64, height: 92, flexShrink: 0, borderRadius: 10, overflow: "hidden", background: "#1C1C1C" }}>
                    <Pic src={it.poster} alt={it.title} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, font: "600 15px/1.3 'DM Sans',sans-serif" }}>{it.title}</p>
                    <p style={{ margin: "4px 0 0", font: "400 12px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>{[kindLabel(it.kind), it.genres.slice(0, 2).join(", "), it.year].filter(Boolean).join(" · ")}</p>
                    {!it.isFree && (
                      <span style={{ whiteSpace: "nowrap", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 3, height: 18, padding: "0 7px", borderRadius: 999, background: "rgba(245,184,65,.15)", color: "#F5B841", font: "700 10px/1 'DM Sans',sans-serif" }}>
                        <Crown size={10} />
                        Premium
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={inL ? "Remove from My List" : "Add to My List"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const added = toggle(it);
                      toast(added ? `Added “${it.title}” to My List` : `Removed “${it.title}” from My List`, added ? undefined : () => toggle(it));
                    }}
                    className="press press-s"
                    style={{ display: "flex", height: 42, width: 42, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: inL ? RED : "#F5F5F5" }}
                  >
                    {inL ? <BookmarkCheck size={19} /> : <BookmarkPlus size={19} />}
                  </button>
                </div>
              );
            })}
            {!loading && deb.trim() === q.trim() && results.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "60px 20px", textAlign: "center", animation: "gpFade .3s both" }}>
                <span style={{ display: "flex", color: "rgba(245,245,245,.4)" }}>
                  <SearchX size={40} />
                </span>
                <p style={{ margin: "6px 0 0", font: "700 17px/1.3 Outfit,sans-serif" }}>Nothing for “{q.trim()}”</p>
                <p style={{ margin: 0, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.65)" }}>
                  Check the spelling or try a genre like {genres[0]?.name || "Drama"} or {genres[1]?.name || "Comedy"}.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
