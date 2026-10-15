import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "@v/hooks/useGoBack";
import { useIsDesktop } from "@v/hooks/useIsDesktop";

// Simple page header with a back arrow (Profile sub-pages, View All, etc.)
export function TopBar({ title, right, center = false, onBack }: { title?: string; right?: ReactNode; center?: boolean; onBack?: () => void }) {
  const goBack = useGoBack();
  const back = onBack ?? goBack;
  const desktop = useIsDesktop();
  if (desktop) {
    // big screens: page title under the top menu (not sticky)
    return (
      <header className="flex items-center gap-3 pb-6 pt-8">
        <button type="button" onClick={back} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[1.75rem] font-bold">{title}</h1>
        {right && <div className="shrink-0">{right}</div>}
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-ink/95 px-2 backdrop-blur">
      <button type="button" onClick={back} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10" aria-label="Back">
        <ArrowLeft className="h-6 w-6" />
      </button>
      <h1 className={center ? "absolute inset-x-14 text-center text-[17px] font-bold uppercase tracking-[.8px]" : "flex-1 truncate text-lg font-semibold"}>{title}</h1>
      <div className="ml-auto">{right}</div>
    </header>
  );
}
