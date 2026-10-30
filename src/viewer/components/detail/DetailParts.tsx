// Small shared pieces of the details screens: the red Play button, loading skeleton and error view.
import { Play } from "lucide-react";
import { AppShell } from "@v/components/AppShell";
import { ErrorState } from "@v/components/States";
import { TopBar } from "@v/components/TopBar";
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { DesktopDetailSkeleton } from "@v/components/desktop/DesktopDetail";

export function PlayButton({ onClick, label = "Play" }: { onClick: () => void; label?: string }) {
  return (
    <div className="px-4 pt-5">
      <button
        type="button"
        onClick={onClick}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#9E1119] via-[#DF4119] to-[#9E1119] text-lg font-bold active:opacity-90"
      >
        <Play className="h-5 w-5" fill="currentColor" />
        {label}
      </button>
    </div>
  );
}

export function DetailSkeleton() {
  const desktop = useIsDesktop();
  if (desktop)
    return (
      <AppShell wide overlay footer={false}>
        <DesktopDetailSkeleton />
      </AppShell>
    );
  return (
    <AppShell nav={false}>
      <div className="shimmer aspect-video w-full" />
      <div className="flex flex-col items-center px-4 pt-5">
        <div className="shimmer h-7 w-[200px] rounded" />
        <div className="shimmer mt-3 h-3 w-48 rounded" />
      </div>
      <div className="px-4 pt-5">
        <div className="shimmer h-[52px] w-full rounded-xl" />
      </div>
      <div className="space-y-2 px-4 pt-4">
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-2/3 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pt-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer h-11 rounded-lg" />
        ))}
      </div>
      <div className="shimmer mx-4 mt-7 h-4 w-28 rounded" />
      <div className="flex gap-3 px-4 pt-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer h-[60px] w-[60px] shrink-0 rounded-full" />
        ))}
      </div>
    </AppShell>
  );
}

export function DetailError({ notFound, onRetry }: { notFound?: boolean; onRetry: () => void }) {
  return (
    <AppShell nav={false}>
      <TopBar />
      {notFound ? (
        <ErrorState message="This title isn't available right now." />
      ) : (
        <ErrorState onRetry={onRetry} />
      )}
    </AppShell>
  );
}

/** true when an axios error is a 404 */
export const isNotFound = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 404;
