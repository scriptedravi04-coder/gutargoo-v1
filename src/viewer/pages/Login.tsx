import { useGoBack } from "@v/hooks/useGoBack";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@v/components/AppShell";
import { PromoCarousel } from "@v/components/profile/PromoCarousel";
import { OtpBoxes } from "@v/components/profile/OtpBoxes";
import { api, errorMessage } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { useToast } from "@v/hooks/useToast";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { storage } from "@v/lib/storage";

const PROMOS = [
  "/img/promo_img3.jpg",
  "/img/promo_the_networker.jpg",
  "/img/promo_img4.jpg",
  "/img/promo_awasaan_trailer.jpg",
  "/img/promo_red_trailer.jpg",
];
const OTP_SECONDS = 300;

// only allow going back to a page of this site after login
const safeNext = (raw: string | null) => (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/");

/** "+91 98765 43210" / "098765 43210" / typed digits → the 10-digit number */
const toTenDigits = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10) {
    if (d.length >= 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
    else return d.slice(0, 10); // one digit too many typed → ignore the extra
  }
  return d.slice(-10);
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function ErrorBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm leading-snug text-red-300" role="alert">
      <CircleAlert className="mt-px h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
    </p>
  );
}

function Terms() {
  return (
    <p className="mt-4 text-center text-[11px] text-[#9E9E9E]">
      By continuing, you agree to our{" "}
      <Link to="/privacy-policy" className="font-semibold text-link">
        Terms &amp; Privacy Policy
      </Link>
    </p>
  );
}

export default function Login() {
  const { isLoggedIn, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const desktop = useIsDesktop();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  // 1 = mobile number · 2 = OTP · 3 = "What's your name?" (first login only, optional)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(OTP_SECONDS);
  const expiresAt = useRef(0);
  const doneRef = useRef(false);

  // countdown on the verify step
  useEffect(() => {
    if (step !== 2) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((expiresAt.current - Date.now()) / 1000)));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [step, expiresAt.current]);

  const sendOtp = async () => {
    if (digits.length !== 10 || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ success?: boolean; message?: string }>("/otp/send", { mobile: digits });
      if (data?.success === false) throw new Error(data.message || "Could not send OTP");
      expiresAt.current = Date.now() + OTP_SECONDS * 1000;
      setLeft(OTP_SECONDS);
      setOtp("");
      setStep(2);
      toast(data?.message || "OTP sent successfully");
    } catch (e) {
      setError(e instanceof Error && !(e as any).isAxiosError ? e.message : errorMessage(e, "Could not send OTP. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code = otp) => {
    if (code.length !== 6 || busy || left === 0) return;
    setBusy(true);
    setError("");
    try {
      const mobile = "91" + digits;
      const { data } = await api.post<{ success?: boolean; message?: string; token?: string }>("/otp/verify", { mobile, otp: code });
      if (data?.success && data.token) {
        doneRef.current = true;
        login(data.token, mobile);
        // brand-new account (no name yet) → ask for a name once, otherwise straight on
        let serverName = "";
        try {
          const r = await api.get<{ data?: { name?: string } }>("/customer/profile");
          serverName = String(r.data?.data?.name || "").trim();
        } catch {
          serverName = "?"; // couldn't check → don't block the login with the name step
        }
        if (serverName && serverName !== "?") storage.setProfile({ ...storage.getProfile(), name: serverName });
        if (!serverName) {
          setStep(3);
          return;
        }
        toast("Logged in successfully");
        navigate(next, { replace: true });
        return;
      }
      const msg = data?.message || "Invalid OTP";
      setError(msg);
      // the server threw this OTP away → let them ask for a new one straight away
      if (/expired|too many|request a new/i.test(msg)) {
        expiresAt.current = Date.now();
        setLeft(0);
      }
      setOtp("");
    } catch (e) {
      setError(errorMessage(e, "Could not verify OTP. Please try again."));
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  // all 6 digits entered → submit
  useEffect(() => {
    if (step === 2 && otp.length === 6) verify(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const finish = () => {
    toast("Logged in successfully");
    navigate(next, { replace: true });
  };

  const saveName = async () => {
    const n = name.trim();
    if (!n) return finish();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.put("/customer/profile", { name: n });
      storage.setProfile({ ...storage.getProfile(), name: n });
      finish();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save your name. You can add it later in My Account."));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (step === 3) return finish();
    if (step === 2) {
      setStep(1);
      setError("");
      return;
    }
    goBack();
  };

  if (isLoggedIn && !doneRef.current) return <Navigate to={next} replace />;

  const expired = step === 2 && left === 0;
  const RESEND_AFTER = 60; // seconds — SMS didn't arrive? allow a new OTP after a minute
  const canResend = expired || OTP_SECONDS - left >= RESEND_AFTER;

  return (
    <AppShell nav={false} wide footer={false}>
      <div
        className={clsx("flex flex-col bg-[linear-gradient(to_bottom,#0D1B14_0%,#000_55%)] desk:mx-auto desk:grid desk:min-h-[calc(100vh-4.5rem)] desk:max-w-6xl desk:items-center desk:gap-8 lg:grid-cols-2 lg:gap-12 desk:bg-none desk:px-[5%] desk:py-10", !desktop && "gp-fill-screen")}
      >
        <div className="flex h-14 items-center px-2 desk:hidden">
          <button type="button" onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>

        <div className="desk:mx-auto desk:w-full desk:max-w-[30rem]">
          <PromoCarousel images={PROMOS} height={step === 1 ? 380 : 360} rotate={0.1} />
          <p className="mt-6 hidden text-center text-2xl font-bold desk:block">Watch On Any Device Free</p>
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-8 desk:mx-auto desk:w-full desk:max-w-md desk:flex-none lg:max-w-none desk:rounded-3xl desk:border desk:border-white/10 desk:bg-[#0E0E0E]/90 desk:p-10">
          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendOtp();
              }}
            >
              <h1 className="text-xl font-bold">Login or Sign up</h1>
              <p className="mt-1 text-[13px] leading-snug text-white/60">Enter your mobile number. We'll send a 6-digit OTP. New here? Your account is created automatically.</p>
              <label className="mt-4 flex h-[54px] items-center rounded-[14px] border border-white/[.12] bg-[#1A1A1A] px-4 focus-within:border-orange">
                <span className="mr-3 flex items-center gap-1.5 text-[15px] font-bold text-orange">
                  <span aria-hidden="true">🇮🇳</span> +91
                </span>
                <span className="mr-3 h-6 w-px bg-white/15" />
                <input
                  value={digits}
                  onChange={(e) => {
                    setDigits(toTenDigits(e.target.value));
                    setError("");
                  }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={16}
                  placeholder="10-digit mobile number"
                  aria-label="Mobile number"
                  autoFocus
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-white outline-none placeholder:tracking-normal placeholder:text-[#8E8E8E]"
                />
              </label>
              <ErrorBox text={error} />
              <button
                type="submit"
                disabled={digits.length !== 10 || busy}
                className={clsx(
                  "mt-5 h-[52px] w-full rounded-xl text-[15px] font-bold transition-colors",
                  digits.length === 10 ? "bg-orange text-white" : "bg-[#424242] text-white/[.38]",
                  busy && "opacity-70"
                )}
              >
                {busy ? "Sending..." : "Send OTP"}
              </button>
              <Terms />
            </form>
          ) : step === 3 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveName();
              }}
            >
              <h1 className="text-xl font-bold">Welcome to Gutargoo+! 🎉</h1>
              <p className="mt-1 text-[13px] leading-snug text-white/60">What's your name? (optional — you can change it later in My Account)</p>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 80));
                  setError("");
                }}
                placeholder="Your name"
                aria-label="Your name"
                autoComplete="name"
                autoFocus
                className="mt-4 h-[54px] w-full rounded-[14px] border border-white/[.12] bg-[#1A1A1A] px-4 text-[15px] text-white outline-none placeholder:text-[#8E8E8E] focus:border-orange"
              />
              <ErrorBox text={error} />
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className={clsx(
                  "mt-5 h-[52px] w-full rounded-xl text-[15px] font-bold transition-colors",
                  name.trim() ? "bg-orange text-white" : "bg-[#424242] text-white/[.38]",
                  busy && "opacity-70"
                )}
              >
                {busy ? "Saving..." : "Save & Continue"}
              </button>
              <button type="button" onClick={finish} disabled={busy} className="mx-auto mt-3 flex h-11 items-center px-4 text-sm font-semibold text-white/60 hover:text-white">
                Skip for now
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <h1 className="text-xl font-bold">Verify OTP</h1>
              <p className="mt-1 text-[13px] text-white/60">Enter the 6-digit code sent to your number.</p>
              <div className="mt-4 flex h-[50px] items-center rounded-[14px] border border-white/[.12] bg-[#1A1A1A] px-4 text-[15px] tracking-[1.2px] text-white/80" aria-label="Mobile number">
                +91 {digits}
              </div>

              <div className="mt-5">
                <OtpBoxes value={otp} onChange={(v) => {
                  setOtp(v);
                  if (error) setError("");
                }} disabled={busy || expired} />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className={clsx(left < 60 ? "text-red-500" : "text-white/70")} aria-live="polite">
                  {expired ? "OTP expired" : `Expires in ${mmss(left)}`}
                </span>
                <button
                  type="button"
                  disabled={!canResend || busy}
                  onClick={sendOtp}
                  className={clsx("-my-2 py-2 pl-3 font-semibold", canResend ? "text-orange" : "text-white/30")}
                >
                  Resend OTP
                </button>
              </div>

              <ErrorBox text={error} />

              <button
                type="submit"
                disabled={otp.length !== 6 || busy || expired}
                className={clsx(
                  "mt-5 h-[54px] w-full rounded-xl text-[15px] font-bold transition-colors",
                  otp.length === 6 && !expired ? "bg-orange text-white" : "bg-[#424242] text-white/[.38]",
                  busy && "opacity-70"
                )}
              >
                {busy ? "Verifying..." : "Verify & Continue"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                }}
                className="mx-auto mt-2 flex h-11 items-center px-3 text-sm text-[#9E9E9E] underline underline-offset-2"
              >
                Change Phone Number?
              </button>
              <Terms />
            </form>
          )}

          <div className="mt-auto flex justify-center pt-8">
            <img src="/img/white_logo.png" alt="Gutargoo+" className="h-9 w-[140px] object-contain" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
