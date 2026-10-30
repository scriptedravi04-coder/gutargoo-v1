import { NavLink } from "react-router-dom";
import { Heart, House, Search, User } from "lucide-react";
import clsx from "clsx";

// Same 4 tabs as the app: Home, Search, Favorite, Profile (active = orange)
const TABS = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/watchlist", label: "My List", icon: Heart, filled: true },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  return (
    <nav data-bottom-nav aria-label="Tabs" className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-[#6B6B6B]/20 bg-bg">
      <div className="flex h-16 items-stretch">
        {TABS.map(({ to, label, icon: Icon, end, filled }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => clsx("flex flex-1 flex-col items-center justify-center gap-1 text-xs", isActive ? "font-semibold text-orange" : "text-white")}
          >
            {({ isActive }) => (
              <>
                <Icon className="h-6 w-6" fill={filled && isActive ? "currentColor" : filled ? "currentColor" : "none"} strokeWidth={filled ? 0 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
