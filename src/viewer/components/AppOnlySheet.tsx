import { Crown, X } from "lucide-react";
import { APP_STORE_URL, PLAY_STORE_URL } from "@v/lib/config";
import { useEscape } from "@v/hooks/useEscape";

// Shown when someone taps a paid title on the web: paid content plays only in the app.
export function AppOnlySheet({ open, title, message, heading, onClose }: { open: boolean; title?: string; message?: string; heading?: string; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 backdrop-blur-[2px] md:items-center" onClick={onClose}>
      <div
        className="animate-pop w-full max-w-app rounded-t-3xl border-t border-white/10 md:max-w-md md:rounded-3xl md:border md:pb-8 bg-gradient-to-b from-[#2A0A0A] to-[#1A0505] p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#B91C1C] to-[#EF4444]">
          <Crown className="h-7 w-7" />
        </div>
        <h2 className="text-center text-xl font-bold">{heading || "Watch on the Gutargoo+ app"}</h2>
        <p className="mt-2 text-center text-sm text-white/70">
          {message ||
            `${title ? `"${title}" is` : "This title is"} a premium title. Premium titles play only in the Gutargoo+ mobile app. Free movies and series play right here.`}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="rounded-lg bg-gradient-to-b from-[#9E1119] via-[#DF4119] to-[#9E1119] py-3 text-center font-semibold">
            Get it on Google Play
          </a>
          {APP_STORE_URL && (
            <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-white/25 bg-[#212121] py-3 text-center font-semibold">
              Download on the App Store
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
