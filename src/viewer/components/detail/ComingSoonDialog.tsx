// "Movie / Web Series Coming Soon" dialog (#1A1A1A card, orange clock and button).
import { Clock } from "lucide-react";
import { useEscape } from "@v/hooks/useEscape";

export function ComingSoonDialog({ open, label, onClose }: { open: boolean; label: "Movie" | "Web Series" | "TV Show"; onClose: () => void }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        className="animate-pop w-full max-w-[340px] rounded-2xl bg-[#1A1A1A] p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange/15">
          <Clock className="h-8 w-8 text-orange" />
        </div>
        <h2 id="coming-soon-title" className="text-lg font-bold">
          {label} Coming Soon
        </h2>
        <p className="mt-2 text-sm text-white/60">This {label.toLowerCase()} isn't available to watch yet. Please check back soon.</p>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-orange py-2.5 font-semibold">
          OK
        </button>
      </div>
    </div>
  );
}
