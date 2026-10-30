// v3 Login (notes 10): cover-flow poster carousel, phone step (+91, n/10 counter), 6-box OTP that
// auto-submits, shake on a wrong code, 30 s resend, name step for brand-new accounts, then back to where they came from.
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { api, errorMessage } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { storage } from "@v/lib/storage";
import { useCatalog } from "@v/hooks/useCatalog";
import { useGoBack } from "@v/hooks/useGoBack";
import { EASE, RED, Shell, Spinner, TOP, useV3Toast, useVisibleBox } from "./ui";

const PROMOS = ["/img/promo_img3.jpg", "/img/promo_the_networker.jpg", "/img/promo_img4.jpg", "/img/promo_awasaan_trailer.jpg", "/img/promo_red_trailer.jpg"];
const RESEND = 30;
const safeNext = (raw: string | null) => (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/profile");
const toTen = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10) {
    if (d.length >= 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
    else return d.slice(0, 10);
  }
  return d.slice(-10);
};
const spaced = (d: string) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

export default function LoginV3() {
  const { isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useV3Toast();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const location = useLocation();
  // opened from a page of this site → go back to it (no duplicate page in the history)
  const finish = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx || 0;
    if ((location.state as { back?: boolean } | null)?.back && idx > 0) navigate(-1);
    else navigate(next, { replace: true });
  };
  const inFlight = useRef(false);
  const { everything } = useCatalog();

  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [, tick] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);
  const verifyTimer = useRef<number>();
  const view = useVisibleBox(); // iPhone keyboard: the form stays in view above it
  const doneRef = useRef(false);

  useEffect(() => {
    if (step !== "otp") return;
    const t = window.setInterval(() => tick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [step]);
  const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));

  // posters for the carousel
  const posters = useMemo(() => {
    const p = everything.map((x) => x.poster).filter(Boolean).slice(0, 8);
    return p.length >= 3 ? p : PROMOS;
  }, [everything]);

  const send = async (resend = false) => {
    if (phone.length !== 10) return toast(`Enter all 10 digits (${phone.length}/10)`);
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post<{ success?: boolean; message?: string }>("/otp/send", { mobile: phone });
      if (data?.success === false) throw Object.assign(new Error(data.message || "Could not send the code"), { plain: true });
      setOtp("");
      setStep("otp");
      setResendAt(Date.now() + RESEND * 1000);
      if (resend) toast("New code sent");
      window.setTimeout(() => otpRef.current?.focus(), 350);
    } catch (e) {
      setErr((e as { plain?: boolean }).plain ? (e as Error).message : errorMessage(e, "Could not send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (code.length !== 6 || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErr("");
    try {
      const mobile = "91" + phone;
      const { data } = await api.post<{ success?: boolean; message?: string; token?: string }>("/otp/verify", { mobile, otp: code });
      if (data?.success && data.token) {
        doneRef.current = true;
        login(data.token, mobile);
        let serverName = "?";
        try {
          const r = await api.get<{ data?: { name?: string } }>("/customer/profile");
          serverName = String(r.data?.data?.name || "").trim();
        } catch {
          /* couldn't check → don't block */
        }
        if (serverName && serverName !== "?") storage.setProfile({ ...storage.getProfile(), name: serverName });
        if (!serverName) {
          setStep("name");
          return;
        }
        toast(serverName !== "?" ? `Welcome back, ${serverName.split(" ")[0]}` : "You're signed in");
        finish();
        return;
      }
      const msg = data?.message || "That code didn't match. Try again.";
      setErr(/invalid/i.test(msg) ? "That code didn't match. Try again." : msg);
      if (/expired|too many|request a new/i.test(msg)) setResendAt(0);
      setShake((x) => x + 1);
      setOtp("");
      window.setTimeout(() => otpRef.current?.focus(), 50);
    } catch (e) {
      setErr(errorMessage(e, "Could not check the code. Please try again."));
      setShake((x) => x + 1);
      setOtp("");
      window.setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const saveName = async (skip = false) => {
    const n = name.trim();
    if (!skip && n) {
      setBusy(true);
      try {
        await api.put("/customer/profile", { name: n });
        storage.setProfile({ ...storage.getProfile(), name: n });
      } catch {
        /* name can be added later in Profile */
      } finally {
        setBusy(false);
      }
    }
    toast(n && !skip ? `Welcome, ${n.split(" ")[0]}` : "You're signed in");
    finish();
  };

  if (isLoggedIn && !doneRef.current && step === "phone") return <Navigate to={next} replace />;

  const visH = parseInt(view.height, 10);
  const typing = focus || step !== "phone";
  const small = typing || visH < 720; // short screens: small posters so the button stays on screen
  // keyboard open on a phone → little room left: drop the posters so the field + button stay visible
  const tight = visH < 520 || (typing && visH < 600); // landscape / tiny phones: no posters at all
  const ok = phone.length === 10;

  return (
    <Shell style={{ position: "fixed", left: 0, right: 0, top: view.top, height: view.height, minHeight: 0, overflow: "hidden" }}>
      <div style={{ position: "relative", display: "flex", height: "100%", overflow: "hidden", flexDirection: "column", animation: `gpPush .45s ${EASE} both` }}>
        <div style={{ height: tight ? 12 : TOP(48), flexShrink: 0, transition: "height .3s" }} />
        <button type="button" aria-label="Close" onClick={goBack} style={{ position: "absolute", right: 14, top: TOP(52), zIndex: 3, display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 999, border: 0, background: "rgba(255,255,255,.08)", color: "rgba(245,245,245,.75)" }}>
          <X size={18} />
        </button>
        <Carousel posters={posters} small={small} hidden={tight} />
        <div style={{ flex: 1, minHeight: 0, padding: `22px 22px calc(${focus && step === "phone" ? 16 : 28}px + var(--sb))`, display: "flex", flexDirection: "column", overflowY: "auto", transition: "padding .35s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ flexGrow: small ? 0 : 1, transition: "flex-grow .45s cubic-bezier(.2,.8,.2,1)" }} />
          {step === "phone" && (
            <div style={{ animation: "gpIn .35s both" }}>
              <h1 style={{ margin: 0, font: "800 28px/1.1 Outfit,sans-serif", letterSpacing: -0.4 }}>
                Watch free.
                <br />
                Pick up anywhere.
              </h1>
              <p style={{ margin: "10px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>Enter your mobile number. We'll text you a 6-digit code — new accounts are created automatically.</p>
              <label className="glass" style={{ marginTop: 22, display: "flex", height: 58, alignItems: "center", gap: 12, padding: "0 16px", borderRadius: 16, border: `1.5px solid ${focus ? "rgba(239,65,48,.7)" : "rgba(255,255,255,.08)"}`, transition: "border-color .25s" }}>
                <span style={{ font: "700 15px/1 'DM Sans',sans-serif", color: "#F5F5F5" }}>+91</span>
                <span style={{ height: 24, width: 1, background: "rgba(255,255,255,.15)" }} />
                <input
                  value={spaced(phone)}
                  onChange={(e) => {
                    setPhone(toTen(e.target.value));
                    setErr("");
                  }}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setFocus(false)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  type="tel"
                  aria-label="Mobile number"
                  placeholder="98765 43210"
                  style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: 0, background: "transparent", color: "#F5F5F5", font: "600 17px/1 'DM Sans',sans-serif", letterSpacing: 1, boxShadow: "none", padding: 0 }}
                />
                <span style={{ font: "600 12px/1 'DM Sans',sans-serif", color: ok ? "#4ade80" : "rgba(245,245,245,.55)" }}>{phone.length}/10</span>
              </label>
              {err && <p style={{ margin: "12px 0 0", font: "500 13px/1.4 'DM Sans',sans-serif", color: "#FF6B5C" }}>{err}</p>}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => send()}
                className="press"
                style={{ marginTop: 16, display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, border: 0, background: ok ? RED : "#262626", color: ok ? "#fff" : "rgba(245,245,245,.7)", font: "700 16px/1 'DM Sans',sans-serif", transition: "background .3s,color .3s" }}
              >
                {busy ? <Spinner size={20} /> : (
                  <>
                    Send code
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {step === "otp" && (
            <div style={{ animation: "gpPush .35s both" }}>
              <h1 style={{ margin: 0, font: "800 28px/1.1 Outfit,sans-serif", letterSpacing: -0.4 }}>Enter the code</h1>
              <p style={{ margin: "10px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>
                Sent to +91 {spaced(phone)} ·{" "}
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setErr("");
                  }}
                  style={{ border: 0, background: "transparent", padding: 0, color: "#F5F5F5", font: "700 14px/1 'DM Sans',sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  Change
                </button>
              </p>
              <div style={{ position: "relative", marginTop: 22 }}>
                <div key={shake} style={{ display: "flex", justifyContent: "space-between", gap: 6, animation: shake ? "gpShake .4s both" : "none" }}>
                  {Array.from({ length: 6 }, (_, i) => {
                    const cur = i === otp.length;
                    return (
                      <div key={i} className="glass" style={{ display: "flex", height: 60, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, border: `1.5px solid ${err ? RED : cur ? "rgba(239,65,48,.8)" : otp[i] ? "rgba(255,255,255,.3)" : "rgba(255,255,255,.08)"}`, font: "700 22px/1 Outfit,sans-serif", transition: "border-color .2s,transform .2s", transform: `scale(${cur ? 1.04 : 1})` }}>
                        {otp[i] || ""}
                      </div>
                    );
                  })}
                </div>
                <input
                  ref={otpRef}
                  value={otp}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(v);
                    setErr("");
                    window.clearTimeout(verifyTimer.current);
                    if (v.length === 6) verifyTimer.current = window.setTimeout(() => verify(v), 120);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="6-digit code"
                  style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", border: 0, color: "transparent", background: "transparent", caretColor: "transparent" }}
                />
              </div>
              <p style={{ margin: "14px 0 0", minHeight: 18, font: "500 13px/1.4 'DM Sans',sans-serif", color: err ? "#FF6B5C" : "rgba(245,245,245,.6)" }}>{busy ? "Checking…" : err || "The code comes by SMS."}</p>
              <button type="button" onClick={() => left === 0 && send(true)} style={{ marginTop: 10, height: 44, padding: 0, border: 0, background: "transparent", color: left > 0 ? "rgba(245,245,245,.55)" : RED, font: "700 14px/1 'DM Sans',sans-serif" }}>
                {left > 0 ? `Resend code in 0:${String(left).padStart(2, "0")}` : "Resend code"}
              </button>
            </div>
          )}

          {step === "name" && (
            <div style={{ animation: "gpPush .35s both" }}>
              <h1 style={{ margin: 0, font: "800 28px/1.1 Outfit,sans-serif", letterSpacing: -0.4 }}>What should we call you?</h1>
              <p style={{ margin: "10px 0 0", font: "400 14px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.7)" }}>Your account is ready. Add your name — or skip for now.</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
                placeholder="Your name"
                aria-label="Your name"
                className="glass"
                style={{ marginTop: 22, width: "100%", height: 58, padding: "0 16px", borderRadius: 16, border: "1.5px solid rgba(255,255,255,.12)", outline: 0, color: "#F5F5F5", font: "600 17px/1 'DM Sans',sans-serif", boxShadow: "none" }}
              />
              <button type="button" onClick={() => saveName()} className="press" style={{ marginTop: 16, display: "flex", height: 54, width: "100%", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, border: 0, background: name.trim() ? RED : "#262626", color: "#fff", font: "700 16px/1 'DM Sans',sans-serif" }}>
                {busy ? <Spinner size={20} /> : "Continue"}
              </button>
              <button type="button" onClick={() => saveName(true)} style={{ marginTop: 6, height: 44, width: "100%", border: 0, background: "transparent", color: "rgba(245,245,245,.7)", font: "600 14px/1 'DM Sans',sans-serif" }}>
                Skip for now
              </button>
            </div>
          )}

          {!(focus && step === "phone") && step !== "name" && (
            <p style={{ margin: "28px 0 0", textAlign: "center", font: "400 12px/1.5 'DM Sans',sans-serif", color: "rgba(245,245,245,.6)" }}>
              By continuing you agree to our{" "}
              <a href="/privacy-policy" style={{ color: "#F5F5F5", fontWeight: 600, textDecoration: "underline" }}>
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy-policy" style={{ color: "#F5F5F5", fontWeight: 600, textDecoration: "underline" }}>
                Privacy Policy
              </a>
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** cover-flow: centre poster full size, neighbours 0.8× / 0.66× dimmed; advances every 3.2 s, loops forever */
function Carousel({ posters, small, hidden = false }: { posters: string[]; small: boolean; hidden?: boolean }) {
  const n = posters.length;
  const [idx, setIdx] = useState(n * 2);
  const [jump, setJump] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(390);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const idxRef = useRef(n * 2);
  idxRef.current = idx;
  useEffect(() => setIdx(n * 2), [n]);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const li = idxRef.current + 1;
      if (li >= n * 4) {
        // silently jump back one cycle with transitions off
        setJump(true);
        setIdx(n * 2 - 1);
        window.setTimeout(() => {
          setJump(false);
          setIdx(n * 2);
        }, 40);
      } else setIdx(li);
    }, 3200);
    return () => window.clearInterval(t);
  }, [n]);
  const tr = jump ? "none" : "transform 1.2s cubic-bezier(.45,0,.2,1),opacity 1.2s";
  return (
    <div ref={boxRef} aria-hidden="true" style={{ position: "relative", flexShrink: 0, overflow: "hidden", height: hidden ? 0 : small ? 172 : 400, opacity: hidden ? 0 : 1, transition: `height .45s ${EASE},opacity .3s` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 400, transform: `scale(${small ? 0.42 : 1})`, transformOrigin: "50% 0", transition: `transform .45s ${EASE}` }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 340, margin: "-170px 0 0 -150px", borderRadius: "50%", background: "radial-gradient(closest-side,rgba(239,65,48,.75),rgba(239,65,48,.3) 55%,transparent)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: 0, top: 10, display: "flex", alignItems: "center", gap: 10, height: 380, transform: `translateX(${w / 2 - 110 - idx * 230}px)`, transition: jump ? "none" : "transform 1.2s cubic-bezier(.45,0,.2,1)" }}>
          {Array.from({ length: n * 6 }, (_, i) => {
            const d = Math.abs(i - idx);
            return (
              <div key={i} style={{ position: "relative", flexShrink: 0, width: 220, height: 328, borderRadius: 22, overflow: "hidden", background: "#1C1C1C", transform: `scale(${d === 0 ? 1 : d === 1 ? 0.8 : 0.66})`, opacity: d > 2 ? 0 : d === 2 ? 0.55 : 1, transition: tr }}>
                {d <= 3 && <img src={posters[i % n]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)", opacity: d === 0 ? 0 : 1, transition: tr }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
