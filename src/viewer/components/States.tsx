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
