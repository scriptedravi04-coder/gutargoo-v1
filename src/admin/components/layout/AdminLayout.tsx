import { ReactNode, useState, useEffect, useRef } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "react-router-dom";
import { confirmLeave, getBlockReason } from "@/lib/leaveGuard";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);

  // Prevent auto-scroll to top on route change - scroll main content instead of window
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Remember the current history entry, so Back can be undone when the admin chooses to stay
  const here = useRef<{ state: unknown; href: string }>({ state: null, href: "" });
  useEffect(() => {
    here.current = { state: window.history.state, href: window.location.href };
  }, [location.key, location.pathname, location.search]);

  // Leave guard: a form is uploading / has an unsaved uploaded video → ask before following
  // sidebar / header links or the browser Back button (BrowserRouter has no useBlocker).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!getBlockReason()) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // same page (or only a #hash change) → nothing is lost
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!confirmLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onPop = (e: PopStateEvent) => {
      if (!getBlockReason()) return;
      const prev = here.current;
      if (!prev.href) return;
      try {
        const from = new URL(prev.href);
        if (from.pathname === window.location.pathname && from.search === window.location.search) return;
      } catch {
        return;
      }
      if (confirmLeave()) return;
      // stay: stop the router from switching pages and put the page's address back
      e.stopImmediatePropagation();
      window.history.pushState(prev.state, "", prev.href);
    };
    document.addEventListener("click", onClick, true);
    // capture listeners on window run before the router's own popstate listener
    window.addEventListener("popstate", onPop, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop, true);
    };
  }, []);

  return (
    <div className="min-h-screen supports-[height:100dvh]:min-h-dvh bg-background">
      <AdminSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={cn(
          "transition-all duration-300 h-screen supports-[height:100dvh]:h-dvh flex flex-col",
          !isMobile && (sidebarCollapsed ? "md:ml-[72px]" : "md:ml-64")
        )}
      >
        <AdminHeader onMenuClick={() => setMobileOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-3 md:p-6">{children}</main>
      </div>
    </div>
  );
}