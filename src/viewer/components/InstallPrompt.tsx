import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, MonitorDown, Share, SquarePlus, X } from "lucide-react";
import { promptInstall, useInstallState } from "../../pwa";
import { useSplashDone } from "./home/splashState";

const DISMISS_KEY = "gp_install_dismissed";
const DISMISS_DAYS = 7;
const SHOW_AFTER_MS = 6000;
const HIDE_ON = ["/watch", "/login", "/potli", "/plans", "/movie", "/series"];

const dismissedRecently = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};
const rememberDismiss = () => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
};

/** One tap: Chrome/Edge → install dialog, iPhone → "Share → Add to Home Screen" guide,
 *  any other browser (or Chrome before it is ready) → short "how to install" help. */
export function useInstallAction() {
  const state = useInstallState();
  const [guideOpen, setGuideOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const run = async () => {
    if (state.canPrompt) return promptInstall();
    if (state.iosGuide) setGuideOpen(true);
    else setHelpOpen(true);
    return false;
  };
  return {
    ...state,
    /** show an Install button at all (everywhere except inside the installed app) */
    showButton: !state.installed,
    run,
    guideOpen,
    helpOpen,
    closeGuide: () => setGuideOpen(false),
    closeHelp: () => setHelpOpen(false),
  };
}

/** Renders whichever install help is open (put once next to an Install button) */
export function InstallDialogs({ action }: { action: ReturnType<typeof useInstallAction> }) {
  return (
    <>
      <IosInstallGuide open={action.guideOpen} onClose={action.closeGuide} />
      <InstallHelpDialog open={action.helpOpen} onClose={action.closeHelp} />
    </>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

/** Browsers without a one-tap install (Firefox, Safari on Mac, TV browsers…) */
export function InstallHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 desk:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install Gutargoo+"
        className="w-full max-w-app rounded-t-3xl border-t border-white/10 bg-[#141414] px-6 pt-5 desk:max-w-lg desk:rounded-3xl desk:border"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <p className="text-base font-bold">Install Gutargoo+</p>
            <p className="text-xs text-white/60">Opens in its own window, like an app</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="mt-5 space-y-4 text-[15px]">
          <li className="flex gap-3">
            <MonitorDown className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <span>
              <b>Chrome / Edge:</b> click the install icon at the right end of the address bar, or open the ⋮ menu → <b>Install Gutargoo+</b> (Edge: Apps → Install).
            </span>
          </li>
          <li className="flex gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <span>
              <b>Android phone:</b> Chrome ⋮ menu → <b>Add to Home screen</b> / <b>Install app</b>.
            </span>
          </li>
          <li className="flex gap-3">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <span>
              <b>Safari (Mac):</b> File → <b>Add to Dock</b>. <b>iPhone:</b> Share → <b>Add to Home Screen</b>.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-white/50">Firefox can't install websites — open this page in Chrome or Edge to install.</p>
        <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-orange text-[15px] font-bold">
          Got it
        </button>
      </div>
    </div>
  );
}

/** iPhone steps (Safari has no install button) */
export function IosInstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 desk:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install Gutargoo+"
        className="w-full max-w-app rounded-t-3xl border-t border-white/10 bg-[#141414] px-6 pt-5 desk:max-w-lg desk:rounded-3xl desk:border"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <p className="text-base font-bold">Install Gutargoo+</p>
            <p className="text-xs text-white/60">Add it to your Home Screen — opens like an app</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ol className="mt-5 space-y-4 text-[15px]">
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-bold">1</span>
            <span className="flex flex-wrap items-center gap-1.5">
              Tap the <Share className="h-5 w-5 text-[#0A84FF]" aria-label="Share" /> <b>Share</b> button in Safari
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-bold">2</span>
            <span className="flex flex-wrap items-center gap-1.5">
              Scroll down, tap <SquarePlus className="h-5 w-5" aria-hidden="true" /> <b>Add to Home Screen</b>
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-bold">3</span>
            <span>
              Tap <b>Add</b> — Gutargoo+ icon will be on your Home Screen
            </span>
          </li>
        </ol>
        <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-xl bg-orange text-[15px] font-bold">
          Got it
        </button>
      </div>
    </div>
  );
}

/** Small banner above the bottom tabs, a few seconds after the site opens (like Ybex) */
export function InstallBanner() {
  const action = useInstallAction();
  const { available, canPrompt, run } = action;
  const splashDone = useSplashDone();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(dismissedRecently);

  useEffect(() => {
    if (!splashDone) return;
    const t = window.setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [splashDone]);

  const hiddenHere = HIDE_ON.some((p) => pathname.startsWith(p));
  const close = () => {
    rememberDismiss();
    setClosed(true);
  };

  return (
    <>
      {available && ready && !closed && !hiddenHere && (
        <div
          className="fixed inset-x-0 z-[45] mx-auto max-w-app px-3 desk:hidden"
          style={{ bottom: "calc(5.6rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1A1A]/95 p-3 shadow-[0_8px_30px_rgba(0,0,0,.7)] backdrop-blur">
            <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">Install Gutargoo+</p>
              <p className="truncate text-xs text-white/60">Add it to your home screen — opens like an app</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await run();
                if (canPrompt && !ok) close(); // said "no" in Chrome's dialog → don't nag
              }}
              className="shrink-0 rounded-lg bg-orange px-4 py-2 text-sm font-bold"
            >
              Install
            </button>
            <button type="button" onClick={close} aria-label="Not now" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <InstallDialogs action={action} />
    </>
  );
}
