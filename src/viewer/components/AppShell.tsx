import { ReactNode } from "react";
import clsx from "clsx";
import { BottomNav } from "@v/v3/ui"; // v3 floating tab bar (Home · Search · Potli · My List · Profile)
import { useIsDesktop } from "@v/hooks/useIsDesktop";
import { TopNav } from "./desktop/TopNav";
import { Footer } from "./desktop/Footer";

// Phones: phone-width column with the bottom tabs (the web app looks like the mobile app).
// Laptop / desktop / TV: full-width site with a top menu.
//   wide    → page uses the full width (home, details, player, grids)
//   overlay → page starts with a big picture; the top menu floats over it
export function AppShell({
  children,
  nav = true,
  className,
  wide = false,
  overlay = false,
  footer = true,
  bg = "bg-ink",
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  wide?: boolean;
  overlay?: boolean;
  footer?: boolean;
  /** phone page background (fills the whole screen) */
  bg?: string;
}) {
  const desktop = useIsDesktop();

  // Both layouts keep the page content at the SAME place in the React tree (root › main › children),
  // so crossing the phone/desktop breakpoint re-styles the page instead of rebuilding it
  // (a playing video keeps playing).
  return (
    <div className={desktop ? "gp-desktop min-h-screen bg-ink" : "min-h-screen bg-[#050505]"}>
      {desktop ? <TopNav overlay={overlay} /> : <div className="gp-statusbar" aria-hidden="true" />}
      <main
        className={
          desktop
            ? clsx(!overlay && "pt-16 lg:pt-[4.5rem]", !wide && "mx-auto w-full max-w-2xl px-6", className)
            : clsx("relative mx-auto min-h-screen max-w-app shadow-[0_0_60px_rgba(0,0,0,.8)]", bg, className)
        }
        style={
          desktop
            ? undefined
            : {
                // below the notch / Dynamic Island when installed; room for the bottom tabs (4rem + a little air)
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: nav ? "calc(6.5rem + env(safe-area-inset-bottom, 0px))" : "env(safe-area-inset-bottom, 0px)",
              }
        }
      >
        {children}
      </main>
      {desktop && footer ? <Footer /> : null}
      {!desktop && nav ? <div className="v3"><BottomNav /></div> : null}
    </div>
  );
}
