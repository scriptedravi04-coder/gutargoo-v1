import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Download, Maximize, Minimize, Search, Smartphone, User } from "lucide-react";
import { useAuth } from "@v/lib/auth";
import { storage } from "@v/lib/storage";
import { APP_STORE_URL, PLAY_STORE_URL } from "@v/lib/config";
import { InstallDialogs, useInstallAction } from "@v/components/InstallPrompt";

const LINKS = [
  { to: "/", label: "Home", match: (p: string, c: string | null) => p === "/" && !c },
  { to: "/?c=movie", label: "Movies", match: (p: string, c: string | null) => p === "/" && c === "movie" },
  { to: "/?c=webseries", label: "Web Series", match: (p: string, c: string | null) => p === "/" && c === "webseries" },
  { to: "/?c=tvshow", label: "TV Shows", match: (p: string, c: string | null) => p === "/" && c === "tvshow" },
  { to: "/watchlist", label: "My List", match: (p: string) => p === "/watchlist" },
];

const isIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Whole-site fullscreen (handy on a TV / projector)
function useFullscreen() {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const supported = !!document.documentElement.requestFullscreen;
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  return { on, toggle, supported };
}

// Big-screen header: logo · menu · search · install · get the app · full screen · profile
export function TopNav({ overlay = false }: { overlay?: boolean }) {
  const { pathname, search } = useLocation();
  const c = new URLSearchParams(search).get("c");
  const { isLoggedIn } = useAuth();
  const install = useInstallAction();
  const fs = useFullscreen();
  const [scrolled, setScrolled] = useState(false);
  const name = storage.getProfile().name;
  const storeUrl = isIphone() && APP_STORE_URL ? APP_STORE_URL : PLAY_STORE_URL;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const solid = !overlay || scrolled;

  return (
    <>
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
          solid ? "bg-[#0A0A0A]/95 shadow-[0_2px_20px_rgba(0,0,0,.6)] backdrop-blur" : "bg-gradient-to-b from-black/85 via-black/40 to-transparent"
        )}
      >
        <div className="flex h-16 items-center gap-6 px-[4%] lg:h-[4.5rem]">
          <Link to="/" aria-label="Gutargoo+ Home" className="shrink-0 rounded">
            <img src="/img/Bevel.png" alt="Gutargoo+" className="h-auto w-32 lg:w-36" draggable={false} />
          </Link>

          <nav aria-label="Main" className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">
            {LINKS.map((l) => {
              const active = l.match(pathname, c);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors lg:text-[15px]",
                    active ? "font-bold text-white" : "text-white/70 hover:text-white"
                  )}
                >
                  {l.label}
                  {active && <span className="mx-auto mt-0.5 block h-0.5 w-5 rounded-full bg-orange" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
            <Link to="/search" aria-label="Search" className={clsx("flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10", pathname === "/search" && "bg-white/10")}>
              <Search className="h-5 w-5" />
            </Link>

            {install.showButton && (
              <button
                type="button"
                onClick={() => void install.run()}
                className="hidden items-center gap-2 rounded-full border border-white/25 px-3.5 py-2 text-sm font-semibold hover:bg-white/10 lg:flex"
              >
                <Download className="h-4 w-4" /> Install
              </button>
            )}

            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-orange px-3.5 py-2 text-sm font-bold text-white hover:bg-orange/90"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden xl:inline">Download App</span>
              <span className="xl:hidden">App</span>
            </a>

            {fs.supported && (
              <button
                type="button"
                onClick={fs.toggle}
                aria-label={fs.on ? "Exit full screen" : "Full screen (TV mode)"}
                title={fs.on ? "Exit full screen" : "Full screen (TV mode)"}
                className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-white/10 lg:flex"
              >
                {fs.on ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
            )}

            {isLoggedIn ? (
              <Link
                to="/profile"
                aria-label="Profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#EF4444] text-sm font-bold"
              >
                {name ? name.trim().charAt(0).toUpperCase() : <User className="h-5 w-5" />}
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">
                  Sign In
                </Link>
                <Link to="/profile" aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                  <User className="h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <InstallDialogs action={install} />
    </>
  );
}
