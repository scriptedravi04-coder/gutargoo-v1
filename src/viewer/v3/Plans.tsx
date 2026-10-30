// v3 Premium plans (notes 08): tilted poster wall, perks, 3 plan cards (from the admin's plans), sticky gold CTA.
// Web payments aren't connected yet → the CTA sends signed-in users to the app (same number) to subscribe.
import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, Crown, Download, MonitorSmartphone, Sparkles, X } from "lucide-react";
import { api } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { useCatalog } from "@v/hooks/useCatalog";
import { useGoBack } from "@v/hooks/useGoBack";
import { GOLD, GOLD_INK, Shell, TOP } from "./ui";
import { AppSheet } from "./Detail";
import { daysText, useClaimFounder, useFounder } from "./founder";
import { useV3Toast, Spinner, RED } from "./ui";
import { errorMessage } from "@v/lib/api";

interface ApiPlan {
  _id: string;
  name: string;
  price: number;
  durationDays: number;
  features?: string[];
  isPopular?: boolean;
}
interface Plan {
  id: string;
  name: string;
  price: number;
  days: number;
  perMonth: number;
  tag: string;
}

const FALLBACK: ApiPlan[] = [
  { _id: "m", name: "Monthly", price: 99, durationDays: 30 },
  { _id: "q", name: "Quarterly", price: 249, durationDays: 90 },
  { _id: "y", name: "Yearly", price: 699, durationDays: 365, isPopular: true },
];
const unit = (days: number) => (days >= 360 ? "year" : days >= 85 ? "quarter" : days >= 28 ? "month" : `${days} days`);

export default function PlansV3() {
  const goBack = useGoBack();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { everything } = useCatalog();
  const [appSheet, setAppSheet] = useState(false);
  const { data } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await api.get<{ data: ApiPlan[] }>("/plans")).data?.data || [],
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
  const plans: Plan[] = useMemo(() => {
    const src = (data && data.length ? data : FALLBACK).filter((p) => p.price > 0 && p.durationDays > 0).slice(0, 3);
    const monthly = src.reduce((m, p) => Math.max(m, p.price / (p.durationDays / 30)), 0);
    return src.map((p) => {
      const pm = p.price / (p.durationDays / 30);
      const save = monthly > 0 ? Math.round((1 - pm / monthly) * 100) : 0;
      return { id: p._id, name: p.name, price: p.price, days: p.durationDays, perMonth: Math.round(pm), tag: save >= 10 ? `Save ${save}%` : p.isPopular ? "Popular" : "" };
    });
  }, [data]);
  const defaultId = (data || FALLBACK).find((p) => p.isPopular)?._id || plans[plans.length - 1]?.id;
  const [pick, setPick] = useState<string | null>(null);
  const sel = plans.find((p) => p.id === (pick || defaultId)) || plans[0];
  const posters = useMemo(() => {
    const p = everything.map((x) => x.poster).filter(Boolean);
    return p.length ? [...p, ...p, ...p].slice(0, 8) : [];
  }, [everything]);

  const subscribe = () => {
    if (!isLoggedIn) return navigate("/login?next=/plans", { state: { back: true } });
    setAppSheet(true);
  };

  const founder = useFounder();
  if (founder.isLoading) {
    return (
      <Shell>
        <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>
          <Spinner />
        </div>
      </Shell>
    );
  }
  if (founder.data && (founder.data.active || founder.data.isFounder)) return <FounderView posters={posters} />;

  return (
    <Shell>
      <div style={{ position: "relative", minHeight: "100dvh", animation: "gpRise .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, width: "120%", marginLeft: "-10%", transform: "rotate(-7deg) translateY(-50px)" }}>
            {posters.map((p, i) => (
              <img key={i} src={p} alt="" style={{ width: "100%", height: 150, borderRadius: 12, objectFit: "cover" }} />
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,.45),rgba(0,0,0,.8) 60%,#000)" }} />
        </div>
        <div style={{ position: "sticky", top: 0, zIndex: 5, height: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: `${TOP(50)} 14px 0` }}>
            <button type="button" aria-label="Close" onClick={goBack} style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "rgba(0,0,0,.55)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", color: "#fff" }}>
              <X size={19} />
            </button>
          </div>
        </div>
        <div style={{ position: "relative", padding: `calc(var(--st) + 104px) 20px 0` }}>
          <span style={{ display: "inline-flex", whiteSpace: "nowrap", alignItems: "center", gap: 6, font: "700 11px/1 'DM Sans',sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: GOLD }}>
            <Crown size={14} />
            Gutargoo+ Premium
          </span>
          <h1 style={{ margin: "12px 0 0", font: "800 32px/1.04 Outfit,sans-serif", letterSpacing: -0.6, color: "#fff" }}>
            Every original.
            <br />
            No ads.
          </h1>
          <p style={{ margin: "10px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.72)" }}>Premium series and movies on web and the app, with the same mobile number.</p>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            {[
              [Sparkles, "All originals"],
              [Ban, "No ads"],
              [Download, "Downloads"],
              [MonitorSmartphone, "Full HD"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Sparkles;
              return (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", font: "600 13px/1.25 'DM Sans',sans-serif", color: "#fff" }}>
                  <span style={{ display: "flex", flexShrink: 0, color: GOLD }}>
                    <I size={18} />
                  </span>
                  {label as string}
                </div>
              );
            })}
          </div>
          <p style={{ margin: "26px 0 12px", font: "700 11px/1 'DM Sans',sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(245,245,245,.6)" }}>Choose a plan</p>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, plans.length)},minmax(0,1fr))`, gap: 8 }}>
            {plans.map((p) => {
              const on = p.id === sel?.id;
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setPick(p.id)} className="press" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "16px 12px 14px", borderRadius: 16, border: `1.5px solid ${on ? GOLD : "rgba(255,255,255,.1)"}`, background: on ? "rgba(245,184,65,.1)" : "rgba(255,255,255,.04)", color: "#fff", textAlign: "left", transition: "border-color .25s,background .25s" }}>
                  {p.tag && <span style={{ whiteSpace: "nowrap", position: "absolute", top: -9, left: 10, display: "flex", alignItems: "center", height: 18, padding: "0 8px", borderRadius: 999, background: GOLD, color: GOLD_INK, font: "700 9.5px/1 'DM Sans',sans-serif", letterSpacing: ".06em", textTransform: "uppercase" }}>{p.tag}</span>}
                  <span style={{ font: "600 12px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.75)" }}>{p.name}</span>
                  <span style={{ font: "800 22px/1 Outfit,sans-serif", letterSpacing: -0.3 }}>₹{p.price}</span>
                  <span style={{ font: "500 11px/1.2 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>{p.days <= 31 ? "per month" : `₹${p.perMonth}/mo`}</span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setAppSheet(true)} style={{ marginTop: 14, height: 44, width: "100%", border: 0, background: "transparent", color: "rgba(245,245,245,.8)", font: "600 13px/1 'DM Sans',sans-serif" }}>
            Already a member? <span style={{ color: "#fff", textDecoration: "underline", textUnderlineOffset: 3 }}>Open the app</span>
          </button>
        </div>
        <div aria-hidden="true" style={{ height: 130 }} />
        {createPortal(
<div className="v3" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, maxWidth: 520, margin: "0 auto", padding: "14px 20px calc(26px + var(--sb))", background: "rgba(0,0,0,.9)", WebkitBackdropFilter: "blur(24px) saturate(1.3)", backdropFilter: "blur(24px) saturate(1.3)", borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <button type="button" onClick={subscribe} className="press" style={{ display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, border: 0, background: GOLD, color: GOLD_INK, font: "700 16px/1 'DM Sans',sans-serif" }}>
            {sel ? `Continue · ₹${sel.price}/${unit(sel.days)}` : "Continue"}
          </button>
          <p style={{ margin: "10px 0 0", textAlign: "center", font: "500 11.5px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>Cancel anytime · UPI, cards &amp; wallets</p>
        </div>,
        document.body)}
      </div>
      <AppSheet open={appSheet} onClose={() => setAppSheet(false)} heading={isLoggedIn ? "Get Premium in the app" : "Premium plays in the app"} text={isLoggedIn ? "Subscriptions are bought in the Gutargoo+ app for now. Sign in there with the same number and Premium unlocks here too." : undefined} />
    </Shell>
  );
}

/* ───────── "Free Premium for the first 1000" ───────── */
function FounderView({ posters }: { posters: string[] }) {
  const goBack = useGoBack();
  const navigate = useNavigate();
  const toast = useV3Toast();
  const { isLoggedIn } = useAuth();
  const { data } = useFounder();
  const claim = useClaimFounder();
  const [done, setDone] = useState<{ spot?: number; until?: string } | null>(null);
  if (!data) return null;
  const isMember = !!data.isFounder || !!done;
  const pct = data.limit ? Math.min(100, (data.claimed / data.limit) * 100) : 0;
  const until = done?.until ? new Date(done.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  const onClaim = () => {
    if (!isLoggedIn) return navigate("/login?next=/plans", { state: { back: true } });
    claim.mutate(undefined, {
      onSuccess: (r) => {
        if (r?.success === false) return toast(r.message || "Couldn't claim right now");
        setDone({ spot: r?.data?.spot, until: r?.data?.subscriptionExpiry });
        toast("You're a Founding Member — Premium is on");
      },
      onError: (e) => toast(errorMessage(e)),
    });
  };

  return (
    <Shell>
      <div style={{ position: "relative", minHeight: "100dvh", animation: "gpRise .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, width: "120%", marginLeft: "-10%", transform: "rotate(-7deg) translateY(-50px)" }}>
            {posters.map((p, i) => (
              <img key={i} src={p} alt="" style={{ width: "100%", height: 150, borderRadius: 12, objectFit: "cover" }} />
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,.45),rgba(0,0,0,.8) 60%,#000)" }} />
        </div>
        <div style={{ position: "sticky", top: 0, zIndex: 5, height: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: `${TOP(50)} 14px 0` }}>
            <button type="button" aria-label="Close" onClick={goBack} style={{ display: "flex", height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid rgba(255,255,255,.16)", background: "rgba(0,0,0,.55)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", color: "#fff" }}>
              <X size={19} />
            </button>
          </div>
        </div>

        <div style={{ position: "relative", padding: `calc(var(--st) + 104px) 20px 0` }}>
          {isMember ? (
            <div style={{ textAlign: "center", paddingTop: 20, animation: "gpRise .5s both" }}>
              <div style={{ margin: "0 auto", display: "flex", height: 76, width: 76, alignItems: "center", justifyContent: "center", borderRadius: 24, background: GOLD, color: GOLD_INK, boxShadow: "0 12px 40px rgba(245,184,65,.35)", animation: "gpPopIn .5s cubic-bezier(.3,1.5,.5,1) both" }}>
                <Crown size={36} />
              </div>
              <p style={{ margin: "18px 0 0", font: "700 11px/1 'DM Sans',sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: GOLD }}>Founding Member{done?.spot ? ` #${done.spot}` : ""}</p>
              <h1 style={{ margin: "10px 0 0", font: "800 30px/1.08 Outfit,sans-serif", letterSpacing: -0.5 }}>
                You're in.
                <br />
                Premium is on.
              </h1>
              <p style={{ margin: "10px auto 0", maxWidth: 300, font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.72)" }}>
                {until ? `Free until ${until}. ` : ""}Works here and in the Gutargoo+ app with the same number.
              </p>
              <button type="button" onClick={() => navigate("/")} className="press" style={{ marginTop: 24, display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", borderRadius: 16, border: 0, background: RED, color: "#fff", font: "700 16px/1 'DM Sans',sans-serif" }}>
                Start watching
              </button>
            </div>
          ) : (
            <>
              <span style={{ display: "inline-flex", whiteSpace: "nowrap", alignItems: "center", gap: 6, font: "700 11px/1 'DM Sans',sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: GOLD }}>
                <Crown size={14} />
                Founding Member offer
              </span>
              <h1 style={{ margin: "12px 0 0", font: "800 32px/1.04 Outfit,sans-serif", letterSpacing: -0.6, color: "#fff" }}>
                Free Premium
                <br />
                for the first {data.limit.toLocaleString("en-IN")}.
              </h1>
              <p style={{ margin: "10px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.72)" }}>
                Be one of our first {data.limit.toLocaleString("en-IN")} viewers and get Gutargoo+ Premium free for {daysText(data.days)}. No card, no payment — just your mobile number.
              </p>

              <div style={{ marginTop: 20, padding: 14, borderRadius: 16, background: "rgba(245,184,65,.08)", border: "1px solid rgba(245,184,65,.35)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ font: "800 22px/1 Outfit,sans-serif", color: GOLD }}>{data.left.toLocaleString("en-IN")}</span>
                  <span style={{ font: "600 12px/1 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>of {data.limit.toLocaleString("en-IN")} spots left</span>
                </div>
                <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(2, pct)}%`, borderRadius: 999, background: GOLD, transformOrigin: "left", animation: "gpFill 1.2s cubic-bezier(.2,.8,.2,1) both" }} />
                </div>
              </div>

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                {[
                  [Sparkles, "All originals"],
                  [Ban, "No ads"],
                  [Download, "Downloads in app"],
                  [MonitorSmartphone, "Full HD"],
                ].map(([Icon, label]) => {
                  const I = Icon as typeof Sparkles;
                  return (
                    <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", font: "600 13px/1.25 'DM Sans',sans-serif", color: "#fff" }}>
                      <span style={{ display: "flex", flexShrink: 0, color: GOLD }}>
                        <I size={18} />
                      </span>
                      {label as string}
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: "16px 0 0", font: "400 12px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.55)" }}>One spot per mobile number. Premium works here and in the Gutargoo+ app with the same number.</p>
            </>
          )}
        </div>

        {!isMember && (
          <>
          <div aria-hidden="true" style={{ height: 130 }} />
        {createPortal(
<div className="v3" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, maxWidth: 520, margin: "0 auto", padding: "14px 20px calc(26px + var(--sb))", background: "rgba(0,0,0,.9)", WebkitBackdropFilter: "blur(24px) saturate(1.3)", backdropFilter: "blur(24px) saturate(1.3)", borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <button type="button" onClick={onClaim} disabled={claim.isPending} className="press" style={{ display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, border: 0, background: GOLD, color: GOLD_INK, font: "700 16px/1 'DM Sans',sans-serif" }}>
              {claim.isPending ? <Spinner size={18} /> : <Crown size={18} />}
              {isLoggedIn ? "Claim my free Premium" : "Sign in & claim free Premium"}
            </button>
            <p style={{ margin: "10px 0 0", textAlign: "center", font: "500 11.5px/1.4 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>Takes 10 seconds · new accounts are created automatically</p>
          </div>,
        document.body)}
          </>
        )}
      </div>
    </Shell>
  );
}
