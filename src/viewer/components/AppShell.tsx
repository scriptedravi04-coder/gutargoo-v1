import { ReactNode } from "react";
import clsx from "clsx";
import { BottomNav } from "./BottomNav";
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
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
  wide?: boolean;
  overlay?: boolean;
  footer?: boolean;
}) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <div className="gp-desktop min-h-screen bg-ink">
        <TopNav overlay={overlay} />
        <main className={clsx(!overlay && "pt-16 lg:pt-[4.5rem]", !wide && "mx-auto w-full max-w-2xl px-6", className)}>{children}</main>
        {footer && <Footer />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <div
        className={clsx("relative mx-auto min-h-screen max-w-app bg-ink shadow-[0_0_60px_rgba(0,0,0,.8)]", className)}
        style={nav ? { paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" } : undefined}
      >
        {children}
      </div>
      {nav && <BottomNav />}
    </div>
  );
}
