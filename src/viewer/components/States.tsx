import { Film, Loader2, WifiOff } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-8 w-8 animate-spin text-orange ${className}`} />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function ErrorState({ onRetry, message = "Couldn't load. Check your internet and try again." }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-8 text-center">
      <WifiOff className="h-10 w-10 text-white/40" />
      <p className="text-sm text-white/70">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-lg bg-orange px-5 py-2 text-sm font-semibold">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-8 text-center">
      <Film className="h-10 w-10 text-white/30" />
      <p className="font-semibold text-white/80">{title}</p>
      {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
    </div>
  );
}

/** Some lists loaded, some didn't: a small line with Retry above the rows */
export function PartialRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className="mx-4 my-2 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 desk:mx-0 desk:text-sm">
      <WifiOff className="h-4 w-4 shrink-0 text-white/40" />
      <span className="min-w-0 flex-1">Some titles didn't load.</span>
      <button type="button" onClick={onRetry} className="shrink-0 rounded-md bg-orange px-3 py-1 font-semibold text-white">
        Retry
      </button>
    </div>
  );
}
