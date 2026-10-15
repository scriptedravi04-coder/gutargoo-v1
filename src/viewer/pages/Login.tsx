import { useGoBack } from "@v/hooks/useGoBack";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { AppShell } from "@v/components/AppShell";
import { PromoCarousel } from "@v/components/profile/PromoCarousel";
import { OtpBoxes } from "@v/components/profile/OtpBoxes";
import { api, errorMessage } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { useToast } from "@v/hooks/useToast";

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

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<1 | 2>(1);
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

  const back = () => {
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
        className="flex min-h-screen flex-col bg-[linear-gradient(to_bottom,#0D1B14_0%,#000_55%)] md:mx-auto md:grid md:min-h-[calc(100vh-4.5rem)] md:max-w-6xl md:grid-cols-2 md:items-center md:gap-12 md:bg-none md:px-[5%] md:py-10"
      >
        <div className="flex h-14 items-center px-2 md:hidden">
          <button type="button" onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
            <ArrowLeft className="h-6 w-6" />
          </button>
        </div>

        <div>
          <PromoCarousel images={PROMOS} height={step === 1 ? 380 : 360} rotate={0.1} />
          <p className="mt-6 hidden text-center text-2xl font-bold md:block">Watch On Any Device Free</p>
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-8 md:flex-none md:rounded-3xl md:border md:border-white/10 md:bg-[#0E0E0E]/90 md:p-10">
          {step === 1 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendOtp();
              }}
            >
              <h1 className="text-lg font-bold">Login with Mobile</h1>
              <label className="mt-4 flex h-[54px] items-center rounded-[14px] border border-white/[.12] bg-[#1A1A1A] px-4 focus-within:border-orange">
                <span className="mr-3 flex items-center gap-1.5 text-[15px] font-bold text-orange">
                  <span aria-hidden="true">🇮🇳</span> +91
                </span>
                <span className="mr-3 h-6 w-px bg-white/15" />
                <input
                  value={digits}
                  onChange={(e) => {
                    setDigits(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setError("");
                  }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  aria-label="Mobile number"
                  autoFocus
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-white outline-none placeholder:tracking-normal placeholder:text-[#8E8E8E]"
                />
              </label>
              {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
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
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <h1 className="text-lg font-bold">Verify OTP</h1>
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
                  className={clsx("font-semibold", canResend ? "text-orange" : "text-[#424242]")}
                >
                  Resend OTP
                </button>
              </div>

              {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}

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
                className="mx-auto mt-4 block text-sm text-[#9E9E9E] underline underline-offset-2"
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
