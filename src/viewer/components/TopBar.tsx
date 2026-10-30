import { ReactNode } from "react";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "@v/hooks/useGoBack";
import { useIsDesktop } from "@v/hooks/useIsDesktop";

// The ONE page header used by every phone page (same height, padding and title size everywhere):
//   phones  → 56px bar that sticks right under the notch / status bar
//   desktop → page title under the top menu (not sticky)
// `back={false}` for the tab pages (Profile, My List) that have nothing to go back to.
export function TopBar({
  title,
  right,
  center = false,
  back: showBack = true,
  onBack,
  className,
}: {
  title?: string;
  right?: ReactNode;
  center?: boolean;
  back?: boolean;
  onBack?: () => void;
  /** phone bar background (default black) */
  className?: string;
}) {
  const goBack = useGoBack();
  const back = onBack ?? goBack;
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <header className="flex items-center gap-3 pb-6 pt-8">
        {showBack && (
          <button type="button" onClick={back} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[1.75rem] font-bold">{title}</h1>
        {right && <div className="shrink-0">{right}</div>}
      </header>
    );
  }
  return (
    <header className={clsx("sticky-top z-30 flex h-14 items-center gap-1 backdrop-blur", showBack ? "pl-1.5 pr-2" : "px-4", className || "bg-ink/95")}>
      {showBack && (
        <button type="button" onClick={back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 active:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-6 w-6" />
        </button>
      )}
      <h1
        className={
          center
            ? "pointer-events-none absolute inset-x-14 truncate text-center text-[17px] font-bold uppercase tracking-[.6px]"
            : "min-w-0 flex-1 truncate text-lg font-bold"
        }
      >
        {title}
      </h1>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </header>
  );
}
