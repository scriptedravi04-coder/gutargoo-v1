// v3 Home (notes 03): glass header, category chips, hero carousel (5 s), Continue watching,
// admin rows, Top 10, brand footer.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Clapperboard, Crown, Heart, Play, Plus, Search, Tv, User } from "lucide-react";
import { useCatalog, Banner, Section } from "@v/hooks/useCatalog";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useAuth } from "@v/lib/auth";
import { storage } from "@v/lib/storage";
import type { Item, Kind } from "@v/lib/content";
import { HomePopup } from "@v/components/home/HomePopup";
import { useWidth, EASE, GOLD, GOLD_INK, H3, HRow, kindLabel, Pic, PosterCard, seasonsText, durText, Shell, SkeletonPosters, TOP, useOpenDetail, useV3Toast, RED } from "./ui";
import { useContinue } from "./useContinue";
import { playTarget } from "./play";
import { useHomeSettings } from "./useSettings";
import { useFounder } from "./founder";
import { isPro } from "./pro";

type Cat = "all" | Kind;
const CATS: [Cat, string][] = [
  ["all", "All"],
  ["movie", "Movies"],
  ["webseries", "Web Series"],
  ["tvshow", "TV Shows"],
];
const EMPTY_TXT: Record<Kind, [string, string]> = {
  movie: ["No movies yet", "We're adding new movies soon. Meanwhile, try something else."],
  webseries: ["No web series yet", "We're adding new series soon. Meanwhile, try something else."],
  tvshow: ["No TV shows yet", "We're adding new shows soon. Meanwhile, try something else."],
};
const INDEX = new Set(["index_vertical", "index_horizontal"]);

/** cold start opens Potli (once per visit, only when the visit starts on Home) */
let coldChecked = false;
function useColdStartToPotli() {
  const navigate = useNavigate();
  useEffect(() => {
    if (coldChecked) return;
    coldChecked = true;
    let first = true;
    try {
      first = sessionStorage.getItem("gp_v3_started") !== "1";
      sessionStorage.setItem("gp_v3_started", "1");
    } catch {
      /* ignore */
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx || 0;
    if (first && idx === 0 && window.location.pathname === "/" && !window.location.search) navigate("/potli", { replace: true });
  }, [navigate]);
}

export default function HomeV3() {
  useColdStartToPotli();
  const cat0 = (() => {
    try {
      return (sessionStorage.getItem("gp_v3_cat") as Cat) || "all";
    } catch {
      return "all" as Cat;
    }
  })();
  const [cat, setCatState] = useState<Cat>(cat0);
  const setCat = (c: Cat) => {
    setCatState(c);
    try {
      sessionStorage.setItem("gp_v3_cat", c);
    } catch {
      /* ignore */
    }
  };
  const { sections, banners, byId, everything, loading, error, refetch } = useCatalog();
  const cw = useContinue(byId);
  const settings = useHomeSettings();
  const founder = useFounder();
  const openDetail = useOpenDetail();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const name = (storage.getProfile().name || "").trim();

  // header layer after 24px of scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const inCat = (it: Item) => cat === "all" || it.kind === cat;
  const pool = useMemo(() => everything.filter(inCat), [everything, cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const hero = useMemo(() => banners.filter((b) => b.item && inCat(b.item)).slice(0, settings.bannerLimit), [banners, cat, settings.bannerLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const { rows, top10 } = useMemo(() => {
    const secs = sections.map((s) => ({ ...s, items: s.items.filter(inCat) })).filter((s) => s.items.length);
    const idxSec = secs.find((s) => INDEX.has(s.style));
    let rows: Section[] = secs.filter((s) => !INDEX.has(s.style));
    if (!rows.length && pool.length) {
      rows = [
        { id: "", title: "Trending now", style: "vertical_banner", items: [...pool].sort((a, b) => b.views - a.views).slice(0, 20) },
        { id: "", title: "New on Gutargoo+", style: "vertical_banner", items: [...pool].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 20) },
      ];
    }
    const top10 = (idxSec ? idxSec.items : [...pool].sort((a, b) => b.views - a.views)).slice(0, 10);
    return { rows, top10, idxTitle: idxSec?.title };
  }, [sections, pool, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const empty = !loading && cat !== "all" && pool.length === 0;
  const footStrip = useMemo(() => {
    const p = everything.map((x) => x.poster).filter(Boolean).slice(0, 10);
    return p.length ? [...p, ...p, ...p, ...p].slice(0, Math.max(20, p.length * 2)) : [];
  }, [everything]);

  return (
    <Shell nav>
      <div style={{ animation: `gpIn .45s ${EASE} both`, paddingBottom: 96 }}>
        {/* sticky header + chips */}
        <div style={{ position: "sticky", top: 0, zIndex: 30 }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "calc(var(--st) + 156px)",
              background: "rgba(0,0,0,.94)",
              WebkitBackdropFilter: "blur(20px)",
              backdropFilter: "blur(20px)",
              WebkitMask: "linear-gradient(#000 calc(100% - 14px),transparent)",
              mask: "linear-gradient(#000 calc(100% - 14px),transparent)",
              opacity: scrolled ? 1 : 0,
              transition: "opacity .3s",
              pointerEvents: "none",
            }}
          />
          <header style={{ position: "relative", display: "flex", height: `calc(var(--st) + 54px)`, alignItems: "center", justifyContent: "space-between", padding: `${TOP(48)} 16px 0 18px` }}>
            <img src="/img/wordmark-v3.png" alt="Gutargoo+" style={{ width: 118, height: "auto" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" aria-label="Search" onClick={() => navigate("/search")} className="press press-s" style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "rgba(255,255,255,.08)", color: "#F5F5F5" }}>
                <Search size={20} />
              </button>
              <button type="button" aria-label="Profile" onClick={() => navigate("/profile")} className="press press-s" style={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: RED, color: "#fff", font: "700 15px/1 Outfit,sans-serif" }}>
                {isLoggedIn && name ? name[0].toUpperCase() : <User size={19} />}
              </button>
            </div>
          </header>
          <div className="noscroll" style={{ position: "relative", display: "flex", gap: 8, padding: "10px 16px 12px", overflowX: "auto" }}>
            {CATS.map(([k, label]) => {
              const on = cat === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCat(k)}
                  className="press"
                  style={{ flexShrink: 0, whiteSpace: "nowrap", height: 34, padding: "0 16px", borderRadius: 999, border: `1px solid ${on ? "#F5F5F5" : "rgba(255,255,255,.1)"}`, background: on ? "#F5F5F5" : "rgba(255,255,255,.06)", color: on ? "#000" : "rgba(245,245,245,.8)", font: "600 13px/1 'DM Sans',sans-serif", transition: `all .3s ${EASE}` }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {error && !everything.length ? (
          <Empty icon={<Tv size={28} />} title="Couldn't load" text="Please check your connection and try again." cta="Try again" onCta={() => refetch()} />
        ) : empty ? (
          <Empty icon={<Tv size={28} />} title={EMPTY_TXT[cat as Kind][0]} text={EMPTY_TXT[cat as Kind][1]} cta="Browse everything" onCta={() => setCat("all")} />
        ) : (
          <>
            <Hero banners={hero} loading={loading} cw={cw} onOpen={openDetail} slideSec={settings.bannerAutoSlideSeconds} />

            {founder.data?.active && !founder.data.isFounder && !isPro() && (
              <button
                type="button"
                onClick={() => navigate("/plans")}
                className="press"
                style={{ margin: "22px 18px 0", width: "calc(100% - 36px)", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, border: "1px solid rgba(245,184,65,.4)", background: "linear-gradient(100deg,rgba(245,184,65,.16),rgba(245,184,65,.04))", color: "#F5F5F5", textAlign: "left", animation: "gpRise .6s .05s both" }}
              >
                <span style={{ display: "flex", height: 38, width: 38, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, background: GOLD, color: GOLD_INK }}>
                  <Crown size={20} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "700 14px/1.25 'DM Sans',sans-serif" }}>Free Premium for the first {founder.data.limit.toLocaleString("en-IN")}</span>
                  <span style={{ display: "block", marginTop: 3, font: "500 12px/1.3 'DM Sans',sans-serif", color: GOLD }}>Only {founder.data.left.toLocaleString("en-IN")} spots left · claim yours</span>
                </span>
                <ChevronRight size={18} color="rgba(245,245,245,.6)" />
              </button>
            )}

            {cat === "all" && settings.showContinueWatching && cw.length > 0 && (
              <section style={{ marginTop: 28, animation: "gpRise .6s .1s both" }}>
                <div style={{ padding: "0 18px" }}>
                  <H3>Continue watching</H3>
                </div>
                <HRow>
                  {cw.map((c) => (
                    <div key={c.id} className="press" onClick={() => navigate(c.item.isFree ? c.path : "/plans")} role="link" tabIndex={0} style={{ flexShrink: 0, width: 228, cursor: "pointer" }}>
                      <div style={{ position: "relative", height: 128, borderRadius: 14, overflow: "hidden", background: "#1C1C1C" }}>
                        <Pic src={c.img} pos="center 30%" />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.6),transparent 55%)" }} />
                        <span style={{ position: "absolute", left: 10, bottom: 12, display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(255,255,255,.92)", color: "#000", paddingLeft: 2 }}>
                          <Play size={14} fill="currentColor" />
                        </span>
                        {c.badge && (
                          <span style={{ whiteSpace: "nowrap", position: "absolute", left: 10, top: 10, display: "flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", font: "700 11px/1 'DM Sans',sans-serif", color: "#F5F5F5" }}>{c.badge}</span>
                        )}
                        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,.2)" }}>
                          <div style={{ height: "100%", width: `${c.pct}%`, background: RED }} />
                        </div>
                      </div>
                      <p style={{ margin: "10px 0 0", font: "600 14px/1.3 'DM Sans',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                      <p style={{ margin: "3px 0 0", font: "400 12px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>{c.sub}</p>
                    </div>
                  ))}
                </HRow>
              </section>
            )}

            {loading
              ? [0, 1].map((i) => (
                  <section key={i} style={{ marginTop: 28 }}>
                    <div style={{ padding: "0 18px" }}>
                      <div className="shim" style={{ height: 18, width: 150, borderRadius: 6 }} />
                    </div>
                    <HRow>
                      <SkeletonPosters />
                    </HRow>
                  </section>
                ))
              : rows.map((r, i) => (
                  <section key={r.id || r.title + i} style={{ marginTop: 28, animation: "gpRise .6s both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
                      <H3>{r.title}</H3>
                      {r.id && r.items.length > 4 && (
                        <button type="button" onClick={() => navigate(`/section/${r.id}${cat !== "all" ? `?c=${cat}` : ""}`)} style={{ display: "flex", alignItems: "center", gap: 2, border: 0, background: "transparent", padding: "6px 0 6px 8px", font: "600 13px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>
                          See all
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                    <HRow>
                      {r.items.map((it) => (
                        <PosterCard key={it.id} it={it} onOpen={openDetail} />
                      ))}
                    </HRow>
                  </section>
                ))}

            {!loading && settings.showTop10 && top10.length > 2 && (
              <section style={{ marginTop: 28 }}>
                <H3 style={{ padding: "0 18px" }}>Top 10 this week</H3>
                <HRow gap={4}>
                  {top10.map((it, i) => (
                    <div key={it.id} className="press" onClick={() => openDetail(it)} role="link" tabIndex={0} aria-label={`${i + 1}. ${it.title}`} style={{ position: "relative", flexShrink: 0, width: i === 9 ? 182 : 150, height: 168, cursor: "pointer" }}>
                      <span aria-hidden="true" style={{ position: "absolute", left: -4, bottom: -14, font: "900 132px/1 'DM Sans',sans-serif", letterSpacing: -8, color: "transparent", background: "linear-gradient(to bottom,rgba(255,255,255,.95) 20%,rgba(255,255,255,.08) 92%)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
                        {i + 1}
                      </span>
                      <div style={{ position: "absolute", right: 0, top: 0, width: 108, height: 160, borderRadius: 12, overflow: "hidden", background: "#1C1C1C", boxShadow: "-8px 0 20px rgba(0,0,0,.5)" }}>
                        <Pic src={it.poster} alt={it.title} />
                      </div>
                    </div>
                  ))}
                </HRow>
              </section>
            )}

            <footer style={{ position: "relative", marginTop: 44, padding: "30px 20px 34px", overflow: "hidden" }}>
              <p style={{ margin: 0, font: "800 46px/.95 Outfit,sans-serif", letterSpacing: -1.6, color: "rgba(245,245,245,.16)" }}>
                #bas<span style={{ color: "rgba(239,65,48,.55)" }}>ek</span>aur
                <br />
                episode
              </p>
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10, font: "600 15px/1.2 'DM Sans',sans-serif", color: "rgba(245,245,245,.5)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clapperboard size={17} />
                  Kahaniyan, apni zubaan mein
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "flex", color: RED }}>
                    <Heart size={17} fill="currentColor" />
                  </span>
                  Crafted in India
                </span>
              </div>
              {footStrip.length > 0 && (
                <div aria-hidden="true" style={{ position: "relative", margin: "30px -20px 0", height: 120, overflow: "hidden", WebkitMask: "linear-gradient(to bottom,#000 10%,transparent)", mask: "linear-gradient(to bottom,#000 10%,transparent)" }}>
                  <div style={{ display: "flex", gap: 8, width: "max-content", transform: "rotate(-4deg) translate(-20px,8px)" }}>
                    <div style={{ display: "flex", gap: 8, animation: "gpMarquee 60s linear infinite" }}>
                      {[...footStrip, ...footStrip].map((p, i) => (
                        <img key={i} src={p} alt="" loading="lazy" style={{ width: 72, height: 104, borderRadius: 10, objectFit: "cover", filter: "grayscale(1) brightness(.55)", opacity: 0.5 }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </footer>
          </>
        )}
      </div>
      <HomePopup />
    </Shell>
  );
}

function Empty({ icon, title, text, cta, onCta }: { icon: React.ReactNode; title: string; text: string; cta: string; onCta: () => void }) {
  return (
    <div style={{ display: "flex", minHeight: "62vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 40px", textAlign: "center", animation: "gpIn .4s both" }}>
      <div style={{ display: "flex", height: 64, width: 64, alignItems: "center", justifyContent: "center", borderRadius: 20, background: "#1C1C1C", color: "rgba(245,245,245,.7)" }}>{icon}</div>
      <p style={{ margin: "6px 0 0", font: "700 18px/1.3 Outfit,sans-serif" }}>{title}</p>
      <p style={{ margin: 0, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>{text}</p>
      <button type="button" onClick={onCta} style={{ whiteSpace: "nowrap", marginTop: 10, height: 44, padding: "0 22px", borderRadius: 999, border: 0, background: "#F5F5F5", color: "#000", font: "700 14px/1 'DM Sans',sans-serif" }}>
        {cta}
      </button>
    </div>
  );
}

/* ───────── hero carousel ───────── */
function Hero({ banners, loading, cw, onOpen, slideSec }: { banners: Banner[]; loading: boolean; cw: ReturnType<typeof useContinue>; onOpen: (it: Item) => void; slideSec: number }) {
  const navigate = useNavigate();
  const toast = useV3Toast();
  const { has, toggle } = useWatchlist();
  const [slide, setSlide] = useState(0);
  const [wake, setWake] = useState(0);
  const [boxRef, w] = useWidth();
  const n = banners.length;
  const s = Math.min(slide, Math.max(0, n - 1));
  const key = banners.map((b) => b.id).join(",");
  useEffect(() => setSlide(0), [key]);
  // autoplay every 5 s (restarts after a manual change)
  useEffect(() => {
    if (n < 2 || !slideSec) return;
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") setSlide((x) => (x + 1) % n);
      else setWake((x) => x + 1); // tab hidden → try again later instead of stopping for good
    }, slideSec * 1000);
    return () => window.clearTimeout(t);
  }, [s, n, slideSec, wake]);

  // swipe
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const cardW = Math.min(335, w - 55);
  const offset = (w - cardW) / 2 - s * (cardW + 10);

  if (loading) {
    return (
      <div style={{ padding: "8px 27px 0" }}>
        <div className="shim" style={{ height: "min(420px, 55vh)", borderRadius: 22 }} />
      </div>
    );
  }
  if (!n) return null;

  return (
    <div ref={boxRef} style={{ position: "relative", marginTop: "calc(-1 * (var(--st) + 100px))", paddingTop: "calc(var(--st) + 104px)" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0 0 -40px", overflow: "hidden", pointerEvents: "none" }}>
        {banners.map((b, i) => (
          <img key={b.id} src={b.image} alt="" style={{ position: "absolute", inset: -40, width: "calc(100% + 80px)", height: "calc(100% + 80px)", objectFit: "cover", filter: "blur(40px) saturate(1.3)", opacity: i === s ? 0.55 : 0, transition: "opacity .9s ease" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,.35),rgba(0,0,0,.2) 40%,#000 92%)" }} />
      </div>
      <div
        style={{ position: "relative", height: 430, overflow: "hidden", touchAction: "pan-y" }}
        onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, moved: false })}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && Math.abs(e.clientX - d.x) > 12 && Math.abs(e.clientX - d.x) > Math.abs(e.clientY - d.y)) d.moved = true;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || !d.moved) return;
          const dx = e.clientX - d.x;
          if (dx < -40) setSlide((x) => Math.min(n - 1, x + 1));
          else if (dx > 40) setSlide((x) => Math.max(0, x - 1));
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.stopPropagation();
        }}
        aria-roledescription="carousel"
      >
        <div style={{ display: "flex", gap: 10, transform: `translateX(${offset}px)`, transition: `transform .75s ${EASE}` }}>
          {banners.map((b, i) => {
            const it = b.item!;
            const on = i === s;
            const t = playTarget(it, cw);
            const locked = t.locked;
            const inList = has(it.id);
            const meta = [it.genres.slice(0, 2).join(" · "), it.year, it.kind === "movie" ? durText(it.durationMin) : it.seasons.length ? seasonsText(it.seasons.length) : ""].filter(Boolean).join(" · ");
            return (
              <div
                key={b.id}
                onClick={() => (on ? onOpen(it) : setSlide(i))}
                role="group"
                aria-label={it.title}
                style={{ position: "relative", flexShrink: 0, width: cardW, height: "min(420px, 55vh)", minHeight: 300, borderRadius: 22, overflow: "hidden", background: "#1C1C1C", transform: `scale(${on ? 1 : 0.92})`, opacity: on ? 1 : 0.55, transition: `transform .75s ${EASE},opacity .75s`, boxShadow: "0 24px 60px rgba(0,0,0,.55)", cursor: "pointer" }}
              >
                <img src={b.image} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${on ? 1.08 : 1})`, transition: "transform 5.5s ease-out" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 30%,rgba(0,0,0,.7) 58%,rgba(0,0,0,.97) 86%)" }} />
                <div style={{ position: "absolute", left: 20, right: 20, bottom: 20 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 9px", borderRadius: 999, background: locked ? GOLD : "rgba(239,65,48,.92)", font: "700 10px/1 'DM Sans',sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: locked ? GOLD_INK : "#fff", whiteSpace: "nowrap" }}>
                    {locked && <Crown size={11} />}
                    {locked ? "Premium" : i === 0 ? "New release" : kindLabel(it.kind)}
                  </div>
                  <h2 style={{ margin: "10px 0 0", font: "800 32px/1 Outfit,sans-serif", letterSpacing: -0.5, overflowWrap: "anywhere" }}>{it.title || b.title}</h2>
                  {meta && <p style={{ margin: "8px 0 0", font: "500 13px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.75)" }}>{meta}</p>}
                  <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      tabIndex={on ? 0 : -1}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!on) return setSlide(i);
                        if (t.path) navigate(t.path);
                        else onOpen(it);
                      }}
                      className="press"
                      style={{ flex: 1, display: "flex", height: 48, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: 0, background: locked ? GOLD : "#F5F5F5", color: locked ? GOLD_INK : "#000", font: "700 15px/1 'DM Sans',sans-serif", whiteSpace: "nowrap", minWidth: 0 }}
                    >
                      {locked ? <Crown size={18} /> : <Play size={18} fill="currentColor" />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.short}</span>
                    </button>
                    <button
                      type="button"
                      tabIndex={on ? 0 : -1}
                      aria-label={inList ? "Remove from My List" : "Add to My List"}
                      onClick={(e) => {
                        e.stopPropagation();
                        const added = toggle(it);
                        toast(added ? `Added “${it.title}” to My List` : `Removed “${it.title}” from My List`, added ? undefined : () => toggle(it));
                      }}
                      className="press press-s"
                      style={{ display: "flex", height: 48, width: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 14, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.1)", backdropFilter: "blur(10px)", color: "#F5F5F5" }}
                    >
                      {inList ? <Check size={20} /> : <Plus size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {n > 1 && (
        <div style={{ position: "relative", display: "flex", justifyContent: "center", gap: 6, marginTop: 6 }}>
          {banners.map((b, i) => (
            <button key={b.id} type="button" aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} style={{ position: "relative", height: 4, width: i === s ? 28 : 8, padding: 0, border: 0, borderRadius: 999, background: "rgba(245,245,245,.25)", overflow: "hidden", transition: `width .4s ${EASE}` }}>
              {i === s && <span key={`${s}-${key}`} style={{ position: "absolute", inset: 0, background: "#F5F5F5", transformOrigin: "left", animation: slideSec ? `gpFill ${slideSec}s linear both` : "none", transform: slideSec ? undefined : "none" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
