import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Like the app: a new page always opens at the top; going back returns to where you were.
// (Without this, opening a page from a scrolled-down Home would open it half-way down.)
const positions = new Map<string, number>();

export function ScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const currentKey = useRef(location.key);
  const lastPath = useRef(location.pathname);

  // one listener for the whole site: keeps the scroll position of the page on screen
  useEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* old browsers */
    }
    const save = () => positions.set(currentKey.current, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

  useLayoutEffect(() => {
    const prevKey = currentKey.current;
    const samePage = lastPath.current === location.pathname;
    lastPath.current = location.pathname;
    currentKey.current = location.key;
    // only the ?query changed in place (category chips, search box) → stay where you are
    if (navType === "REPLACE" && samePage) {
      positions.set(location.key, positions.get(prevKey) ?? window.scrollY);
      return;
    }
    const target = navType === "POP" ? positions.get(location.key) || 0 : 0;
    if (!target) {
      window.scrollTo(0, 0);
      return;
    }
    // back / forward: restore once the page is tall enough (lazy pages render a moment later)
    let tries = 0;
    let raf = 0;
    const restore = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(target, Math.max(0, maxY)));
      if (maxY < target && tries++ < 40) raf = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(raf);
  }, [location.key, navType]);

  return null;
}
