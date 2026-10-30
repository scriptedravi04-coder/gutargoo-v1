// Title detail (notes 04): poster drops in, text de-blurs in a stagger, notch play button with a red ring
// plays the trailer in place, CTA says exactly what happens, episodes, cast, "Because you watched".
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, BookmarkCheck, BookmarkPlus, Crown, Play, Share2, Star, ThumbsUp, X } from "lucide-react";
import { useMovieQuery, useSeriesQuery } from "@v/components/detail/queries";
import { useCatalog } from "@v/hooks/useCatalog";
import { useWatchlist } from "@v/hooks/useWatchlist";
import { useGoBack } from "@v/hooks/useGoBack";
import { useHls } from "@v/components/player/useHls";
import { episodeThumb } from "@v/components/detail/EpisodeList";
import { episodeUrl, Item } from "@v/lib/content";
import { storage } from "@v/lib/storage";
import type { ApiEpisode } from "@v/lib/api";
import { APP_STORE_URL, PLAY_STORE_URL } from "@v/lib/config";
import { durText, EASE, GlassIcon, GOLD, GOLD_INK, H3, HRow, kindLabel, Pic, PosterCard, PremiumBadge, RED, seasonsText, Sheet, Shell, Spinner, TOP, useOpenDetail, useV3Toast } from "./ui";
import { useContinue } from "./useContinue";
import { playTarget, similarTo } from "./play";
import { compact, shareTitle, useLike } from "./likes";
import { useFounder } from "./founder";

const blur = (delay: number) => ({ animation: `gpBlurIn .6s ${EASE} ${delay}s both` });
const CAST_BG = ["linear-gradient(160deg,#5a2d26,#24120f)", "linear-gradient(160deg,#2d4253,#121b22)", "linear-gradient(160deg,#4d4026,#1e180c)", "linear-gradient(160deg,#41324f,#1a1420)", "linear-gradient(160deg,#2a4a39,#101d16)"];
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export default function DetailV3({ kind }: { kind: "movie" | "series" }) {
  const { id = "" } = useParams();
  const movieQ = useMovieQuery(id, kind === "movie");
  const seriesQ = useSeriesQuery(id, kind === "series");
  const q = kind === "movie" ? movieQ : seriesQ;
  const goBack = useGoBack();

  if (q.isLoading) {
    return (
      <Shell ambient>
        <div className="shim" style={{ height: "min(420px, 58vh)", borderRadius: "0 0 36px 36px" }} />
        <div style={{ padding: "40px 20px 0" }}>
          <div className="shim" style={{ height: 14, width: 120, borderRadius: 6 }} />
          <div className="shim" style={{ marginTop: 14, height: 34, width: "70%", borderRadius: 8 }} />
          <div className="shim" style={{ marginTop: 22, height: 54, borderRadius: 16 }} />
        </div>
      </Shell>
    );
  }
  if (q.error || !q.data) {
    const nf = (q.error as { response?: { status?: number } } | null)?.response?.status === 404 || !q.error;
    return (
      <Shell ambient>
        <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "0 40px", textAlign: "center" }}>
          <p style={{ margin: 0, font: "700 18px/1.3 Outfit,sans-serif" }}>{nf ? "This title isn't available" : "Couldn't load this title"}</p>
          <p style={{ margin: 0, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>{nf ? "It may have been removed." : "Please check your connection and try again."}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" onClick={goBack} style={{ height: 44, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "transparent", color: "#F5F5F5", font: "700 14px/1 'DM Sans',sans-serif" }}>
              Back
            </button>
            {!nf && (
              <button type="button" onClick={() => q.refetch()} style={{ height: 44, padding: "0 20px", borderRadius: 999, border: 0, background: RED, color: "#fff", font: "700 14px/1 'DM Sans',sans-serif" }}>
                Try again
              </button>
            )}
          </div>
        </div>
      </Shell>
    );
  }
  return <DetailBody key={q.data.id} it={q.data} />;
}

function DetailBody({ it }: { it: Item }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useV3Toast();
  const openDetail = useOpenDetail();
  const { everything, byId } = useCatalog();
  const cw = useContinue(byId);
  const { has, toggle } = useWatchlist();
  const like = useLike(it, true);
  const founder = useFounder();
  const offer = founder.data?.active ? founder.data : null;
  const [y, setY] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const [appSheet, setAppSheet] = useState(false);
  const [pops, setPops] = useState({ like: 0, save: 0 });

  useEffect(() => {
    document.title = `${it.title} — Gutargoo+`;
    const on = () => setY(window.scrollY);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [it.title]);

  const t = playTarget(it, cw);
  const series = it.kind !== "movie";
  const inList = has(it.id);
  const chips = [series ? (it.seasons.length ? seasonsText(it.seasons.length) : "") : durText(it.durationMin), ...it.genres.slice(0, 3), it.age].filter(Boolean);
  const similar = useMemo(() => similarTo(it, everything), [it, everything]);
  const people = it.people.slice(0, 20);

  const onPlay = () => {
    if (t.locked) return navigate("/plans");
    if (t.path) return navigate(t.path);
    toast(series ? "Episodes are on their way — check back soon" : "This movie isn't available to watch yet");
  };
  const onTrailer = () => {
    if (it.trailerUrl) setTrailer((x) => !x);
    else onPlay();
  };
  const onSave = () => {
    const added = toggle(it);
    setPops((p) => ({ ...p, save: Date.now() }));
    toast(added ? `Added “${it.title}” to My List` : `Removed “${it.title}” from My List`, added ? undefined : () => toggle(it));
  };

  const headSolid = y > 230;
  const desc = it.description || "";

  return (
    <Shell ambient>
      <div style={{ position: "relative", paddingBottom: 48, animation: "gpFade .15s both" }}>
        {/* top bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 30, height: 0 }}>
          <div style={{ display: "flex", height: `calc(var(--st) + 54px)`, alignItems: "center", gap: 10, padding: `${TOP(46)} 14px 0`, background: headSolid ? "rgba(0,0,0,.95)" : "rgba(0,0,0,0)", WebkitBackdropFilter: headSolid ? "blur(18px)" : "none", backdropFilter: headSolid ? "blur(18px)" : "none", transition: "background .3s" }}>
            <GlassIcon label="Back" onClick={goBack}>
              <ArrowLeft size={20} />
            </GlassIcon>
            <span style={{ flex: 1, opacity: y > 260 ? 1 : 0, transform: `translateY(${y > 260 ? 0 : 6}px)`, transition: "opacity .3s,transform .3s", font: "700 16px/1 Outfit,sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
            <GlassIcon label="Share" onClick={() => shareTitle(it, toast)}>
              <Share2 size={18} />
            </GlassIcon>
          </div>
        </div>

        {/* hero with the notch */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "relative",
              height: "min(420px, 58vh)",
              overflow: "hidden",
              borderRadius: "0 0 36px 36px",
              WebkitMask: "radial-gradient(circle 36px at 50% 100%,transparent 35px,#000 36.5px)",
              mask: "radial-gradient(circle 36px at 50% 100%,transparent 35px,#000 36.5px)",
              animation: "gpDrop .7s cubic-bezier(.22,.9,.24,1) both",
              background: "#111",
            }}
          >
            <img src={it.bigVertical || it.poster || it.banner} alt="" style={{ position: "absolute", left: 0, top: -90, width: "100%", height: "calc(100% + 90px)", objectFit: "cover", objectPosition: "center 25%", transform: `translateY(${Math.min(y, 330) * 0.25}px)` }} />
            {trailer && it.trailerUrl && <InlineTrailer src={it.trailerUrl} onClose={() => setTrailer(false)} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,.4),transparent 26%,transparent 72%,rgba(0,0,0,.4))", pointerEvents: "none" }} />
          </div>
          <button
            type="button"
            aria-label={trailer ? "Stop trailer" : it.trailerUrl ? "Play trailer" : "Play"}
            onClick={onTrailer}
            className="press press-s"
            style={{ whiteSpace: "nowrap", animation: "gpPopIn .45s cubic-bezier(.3,1.5,.5,1) .12s both", position: "absolute", left: "50%", bottom: -26, display: "flex", height: 52, width: 52, marginLeft: -26, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)", background: "rgba(58,52,50,.72)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", backdropFilter: "blur(20px) saturate(1.4)", color: "#fff", padding: trailer ? 0 : "0 0 0 1px", boxShadow: "0 8px 22px rgba(0,0,0,.4)", zIndex: 2 }}
          >
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ position: "absolute", left: -5, top: -5, pointerEvents: "none", transform: "rotate(-90deg)" }}>
              <circle cx="30" cy="30" r="28" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeDasharray="176" style={{ animation: "gpRing .9s cubic-bezier(.65,0,.35,1) .3s both" }} />
            </svg>
            {trailer ? <X size={20} /> : <Play size={20} fill="currentColor" />}
          </button>
        </div>

        <div style={{ padding: "40px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, ...blur(0.38) }}>
            {t.locked && <PremiumBadge />}
            <span style={{ font: "500 13px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>{[it.year, kindLabel(it.kind), it.lang].filter(Boolean).join(" · ")}</span>
          </div>
          <h1 style={{ margin: "10px 0 0", font: "800 34px/1.02 Outfit,sans-serif", letterSpacing: -0.6, overflowWrap: "anywhere", ...blur(0.44) }}>{it.title}</h1>
          {chips.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, ...blur(0.52) }}>
              {chips.map((c, i) => (
                <span key={i} className="glass-chip" style={{ whiteSpace: "nowrap", display: "flex", height: 32, alignItems: "center", padding: "0 14px", borderRadius: 999, font: "600 12px/1 'DM Sans',sans-serif", color: "#F5F5F5" }}>
                  {c}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, ...blur(0.6) }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
              {it.imdb > 0 && (
                <>
                  <span style={{ display: "flex", alignSelf: "center", color: GOLD }}>
                    <Star size={18} fill="currentColor" />
                  </span>
                  <span style={{ font: "800 18px/1 Outfit,sans-serif" }}>
                    {it.imdb.toFixed(1)}
                    <span style={{ fontWeight: 600, fontSize: 14, color: "rgba(245,245,245,.6)" }}>/10</span>
                  </span>
                </>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                aria-label="Like"
                aria-pressed={like.liked}
                onClick={() => {
                  like.toggle();
                  setPops((p) => ({ ...p, like: Date.now() }));
                }}
                className="glass-chip press"
                style={{ whiteSpace: "nowrap", display: "flex", height: 34, alignItems: "center", gap: 6, padding: "0 12px", borderRadius: 999, color: like.liked ? RED : "#F5F5F5", font: "600 12px/1 'DM Sans',sans-serif" }}
              >
                <span key={pops.like} style={{ display: "flex", animation: pops.like && like.liked ? "gpPop .45s cubic-bezier(.3,1.6,.5,1)" : "none" }}>
                  <ThumbsUp size={15} fill={like.liked ? "currentColor" : "none"} />
                </span>
                {like.count !== null && like.count > 0 ? compact(like.count) : like.liked ? "Liked" : "Like"}
              </button>
              <button type="button" aria-label="My List" aria-pressed={inList} onClick={onSave} className="glass-chip press" style={{ whiteSpace: "nowrap", display: "flex", height: 34, alignItems: "center", gap: 6, padding: "0 12px", borderRadius: 999, color: inList ? RED : "#F5F5F5", font: "600 12px/1 'DM Sans',sans-serif" }}>
                <span key={pops.save} style={{ display: "flex", animation: pops.save ? "gpPop .45s cubic-bezier(.3,1.6,.5,1)" : "none" }}>
                  {inList ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                </span>
                {inList ? "In My List" : "My List"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 20, ...blur(0.68) }}>
            {t.locked ? (
              <div style={{ borderRadius: 16, border: "1px solid rgba(245,184,65,.35)", background: "rgba(245,184,65,.08)", padding: 14 }}>
                <p style={{ margin: 0, font: "600 14px/1.4 'DM Sans',sans-serif" }}>Included with Gutargoo+ Premium</p>
                <p style={{ margin: "4px 0 0", font: "400 13px/1.45 'DM Sans',sans-serif", color: "rgba(245,245,245,.68)" }}>{offer ? `Free for the first ${offer.limit.toLocaleString("en-IN")} viewers — ${offer.left.toLocaleString("en-IN")} spots left.` : "Plans from ₹58/month. Everything else stays free."}</p>
                <button type="button" onClick={() => navigate("/plans")} className="press" style={{ marginTop: 12, display: "flex", height: 48, width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, border: 0, background: GOLD, color: GOLD_INK, font: "700 15px/1 'DM Sans',sans-serif" }}>
                  <Crown size={18} />
                  {offer ? "Claim free Premium" : "See plans"}
                </button>
                <button type="button" onClick={() => setAppSheet(true)} style={{ marginTop: 6, height: 40, width: "100%", border: 0, background: "transparent", color: "rgba(245,245,245,.8)", font: "600 13px/1 'DM Sans',sans-serif" }}>
                  Already a member? Open the app
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPlay}
                  className="press"
                  style={{ position: "relative", display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden", borderRadius: 16, border: 0, background: t.path ? RED : "#262626", color: t.path ? "#fff" : "rgba(245,245,245,.7)", font: "700 16px/1 'DM Sans',sans-serif", boxShadow: t.path ? "0 10px 30px rgba(239,65,48,.35)" : "none" }}
                >
                  <Play size={20} fill="currentColor" />
                  {t.path ? t.label : "Coming soon"}
                </button>
                {t.resume && t.pct > 0 && (
                  <div style={{ marginTop: 10, height: 3, borderRadius: 999, background: "rgba(255,255,255,.14)" }}>
                    <div style={{ height: "100%", width: `${t.pct}%`, borderRadius: 999, background: RED }} />
                  </div>
                )}
              </>
            )}
          </div>

          {desc && (
            <>
              <h3 style={{ margin: "28px 0 0", font: "700 19px/1.2 Outfit,sans-serif", ...blur(0.76) }}>Synopsis</h3>
              <p style={{ margin: "10px 0 0", font: "400 14px/1.65 'DM Sans',sans-serif", color: "rgba(245,245,245,.75)", display: "-webkit-box", WebkitLineClamp: descOpen ? 40 : 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line", ...blur(0.76) }}>{desc}</p>
              {desc.length > 150 && (
                <button type="button" onClick={() => setDescOpen((x) => !x)} style={{ marginTop: 4, border: 0, background: "transparent", padding: "4px 0", font: "700 13px/1 'DM Sans',sans-serif", color: "#F5F5F5", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  {descOpen ? "Less" : "More"}
                </button>
              )}
            </>
          )}
        </div>

        {series && it.seasons.length > 0 && <Episodes it={it} locked={t.locked} />}

        {people.length > 0 && (
          <section style={{ marginTop: 26 }}>
            <H3 style={{ padding: "0 20px" }}>Cast</H3>
            <HRow pad="14px 20px 4px">
              {people.map((p, i) => (
                <div key={`${p.name}-${i}`} style={{ width: 112, flexShrink: 0, animation: `gpBlurIn .55s ${EASE} ${0.8 + Math.min(i, 8) * 0.08}s both` }}>
                  <div style={{ position: "relative", display: "flex", height: 138, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 22, background: CAST_BG[i % CAST_BG.length], border: "1px solid rgba(255,255,255,.08)", font: "800 30px/1 Outfit,sans-serif", color: "rgba(245,245,245,.85)" }}>
                    {initials(p.name)}
                    <Pic src={p.image} alt={p.name} fallback={false} />
                  </div>
                  <p style={{ margin: "9px 0 0", font: "600 13px/1.25 'DM Sans',sans-serif" }}>{p.name}</p>
                  {p.role && <p style={{ margin: "2px 0 0", font: "400 11px/1.3 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>{p.role}</p>}
                </div>
              ))}
            </HRow>
          </section>
        )}

        {similar.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <H3 style={{ padding: "0 20px" }}>Because you watched {it.title}</H3>
            <HRow>
              {similar.map((x) => (
                <PosterCard key={x.id} it={x} onOpen={openDetail} />
              ))}
            </HRow>
          </section>
        )}
      </div>
      <AppSheet open={appSheet} onClose={() => setAppSheet(false)} />
    </Shell>
  );
}

/** trailer plays in place, with sound */
function InlineTrailer({ src, onClose }: { src: string; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { error } = useHls(ref, src, {
    autoPlay: true,
    onAutoplayBlocked: (v) => {
      v.muted = true;
      v.play().catch(() => {});
    },
  });
  const toast = useV3Toast();
  useEffect(() => {
    if (error) {
      toast("Trailer couldn't be played");
      onClose();
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  return <video ref={ref} playsInline onEnded={onClose} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000", animation: "gpFade .4s both" }} />;
}

/* ───────── episodes ───────── */
const REMIND_KEY = "gp_remind";
const epDur = (e: ApiEpisode) => Number(e.videoFile?.duration) || 0;

function Episodes({ it, locked }: { it: Item; locked: boolean }) {
  const navigate = useNavigate();
  const toast = useV3Toast();
  const seasons = it.seasons;
  const cwEp = storage.getLocalCw().find((x) => x.id === it.id);
  const startSeason = Math.max(0, seasons.findIndex((s) => (s.episodes || []).some((e) => e._id === cwEp?.epId)));
  const [si, setSi] = useState(startSeason);
  const season = seasons[Math.min(si, seasons.length - 1)];
  const eps = [...(season?.episodes || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const W = 84;
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, padding: "0 18px" }}>
        <H3>Episodes</H3>
        {seasons.length > 1 && (
          <div className="glass noscroll" style={{ position: "relative", display: "flex", padding: 3, borderRadius: 999, maxWidth: "100%", overflowX: "auto" }}>
            <span style={{ whiteSpace: "nowrap", position: "absolute", top: 3, bottom: 3, width: W, borderRadius: 999, background: "#F5F5F5", left: 3 + si * W, transition: "left .35s cubic-bezier(.3,1.3,.5,1)" }} />
            {seasons.map((s, i) => (
              <button key={s._id} type="button" aria-pressed={i === si} onClick={() => setSi(i)} style={{ position: "relative", flexShrink: 0, width: W, height: 38, border: 0, background: "transparent", color: i === si ? "#000" : "rgba(245,245,245,.75)", font: "700 12px/1 'DM Sans',sans-serif", transition: "color .3s" }}>
                Season {s.seasonNumber}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {eps.map((e, i) => {
          const ok = !!episodeUrl(e);
          const d = epDur(e);
          const pos = storage.getProgress(e._id);
          const watched = d > 0 && pos >= d - 30;
          const pct = d > 0 && pos > 10 ? Math.min(100, (pos / d) * 100) : 0;
          const meta = !ok ? "Coming soon" : [d ? `${Math.max(1, Math.round(d / 60))}m` : "", watched ? "Watched" : ""].filter(Boolean).join(" · ") || `Episode ${e.episodeNumber}`;
          return (
            <div
              key={e._id}
              onClick={() => {
                if (!ok) return;
                if (locked) return navigate("/plans");
                navigate(`/watch/series/${it.id}?ep=${e._id}`);
              }}
              role={ok ? "button" : undefined}
              tabIndex={ok ? 0 : undefined}
              style={{ display: "flex", gap: 14, padding: "12px 18px", cursor: ok ? "pointer" : "default", animation: `gpRise .4s ${Math.min(i, 8) * 0.03}s both` }}
            >
              <div style={{ position: "relative", width: 132, height: 76, flexShrink: 0, borderRadius: 12, overflow: "hidden", background: "#1C1C1C" }}>
                <Pic src={episodeThumb(e, it.banner)} pos="center 30%" style={{ filter: ok ? "none" : "grayscale(1) brightness(.6)" }} />
                {ok && (
                  <span style={{ position: "absolute", left: 8, bottom: 8, display: "flex", height: 26, width: 26, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)" }}>
                    <Play size={12} fill="currentColor" />
                  </span>
                )}
                {pct > 0 && (
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "rgba(255,255,255,.2)" }}>
                    <div style={{ height: "100%", width: `${watched ? 100 : pct}%`, background: RED }} />
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
                <p className="clamp2" style={{ margin: 0, font: "600 14px/1.3 'DM Sans',sans-serif" }}>
                  {e.title && !/^(ep|episode)\.?\s*\d+$/i.test(e.title.trim()) ? `${e.episodeNumber}. ${e.title}` : `Episode ${e.episodeNumber}`}
                </p>
                <p style={{ margin: "4px 0 0", font: "400 12px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.62)" }}>{meta}</p>
                {!ok && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      try {
                        const cur: string[] = JSON.parse(localStorage.getItem(REMIND_KEY) || "[]");
                        localStorage.setItem(REMIND_KEY, JSON.stringify([...new Set([...cur, e._id])]));
                      } catch {
                        /* ignore */
                      }
                      toast("We'll remind you when it's out");
                    }}
                    style={{ whiteSpace: "nowrap", marginTop: 8, display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.18)", background: "transparent", color: "#F5F5F5", font: "600 11px/1 'DM Sans',sans-serif" }}
                  >
                    <Bell size={13} />
                    Remind me
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── "Premium plays in the app" sheet ───────── */
export function AppSheet({ open, onClose, heading = "Premium plays in the app", text = "Sign in with the same number on the Gutargoo+ app to watch premium titles. Everything free keeps playing here." }: { open: boolean; onClose: () => void; heading?: string; text?: string }) {
  return (
    <Sheet open={open} onClose={onClose} label={heading}>
      <div style={{ textAlign: "center" }}>
        <div style={{ margin: "4px auto 0", display: "flex", height: 60, width: 60, alignItems: "center", justifyContent: "center", borderRadius: 20, background: GOLD, color: GOLD_INK }}>
          <Crown size={28} />
        </div>
        <h2 style={{ margin: "14px 0 0", font: "800 22px/1.2 Outfit,sans-serif" }}>{heading}</h2>
        <p style={{ margin: "8px auto 0", maxWidth: 290, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>{text}</p>
        <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" style={{ marginTop: 20, display: "flex", height: 52, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, background: "#F5F5F5", color: "#000", font: "700 15px/1 'DM Sans',sans-serif", textDecoration: "none" }}>
          <Play size={16} fill="currentColor" />
          Get it on Google Play
        </a>
        {APP_STORE_URL && (
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" style={{ marginTop: 10, display: "flex", height: 52, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, border: "1px solid rgba(255,255,255,.16)", color: "#F5F5F5", font: "700 15px/1 'DM Sans',sans-serif", textDecoration: "none" }}>
            Download on the App Store
          </a>
        )}
        <button type="button" onClick={onClose} style={{ marginTop: 10, height: 44, width: "100%", border: 0, background: "transparent", color: "rgba(245,245,245,.75)", font: "600 14px/1 'DM Sans',sans-serif" }}>
          Not now
        </button>
      </div>
    </Sheet>
  );
}

export { Spinner };
