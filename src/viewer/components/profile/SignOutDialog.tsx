import { useEscape } from "@v/hooks/useEscape";
// Gradient confirm dialog used by Profile and Edit Profile ("SIGN OUT")
export function SignOutDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEscape(open, onCancel);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-8" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-[340px] rounded-[25px] border border-white/10 bg-gradient-to-br from-[#0A2A4F] via-black to-[#2B0A3D] p-6 text-center shadow-2xl"
      >
        <h2 id="signout-title" className="bg-gradient-to-r from-[#F97316] to-[#EF4444] bg-clip-text text-xl font-extrabold tracking-[2px] text-transparent">
          SIGN OUT
        </h2>
        <p className="mt-3 text-sm text-white/80">Are you sure you want to sign out?</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EF4444] text-sm font-bold text-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
