// A tiny global "are you sure you want to leave?" guard.
// BrowserRouter (not a data router) has no useBlocker, so AdminLayout intercepts internal link clicks
// and the browser Back button, and asks with window.confirm while any form has registered a reason.
import { useEffect, useRef } from "react";

const reasons = new Map<string, string>();
let seq = 0;

/** Register (reason) or clear (null) a leave warning under a key. */
export function setBlocked(key: string, reason: string | null) {
  if (reason) reasons.set(key, reason);
  else reasons.delete(key);
}

/** The newest active reason, or null when leaving is fine. */
export function getBlockReason(): string | null {
  let last: string | null = null;
  reasons.forEach((r) => (last = r));
  return last;
}

/** true = OK to leave (nothing blocks, or the admin confirmed). */
export function confirmLeave(): boolean {
  const reason = getBlockReason();
  return !reason || window.confirm(reason);
}

/** Forms call this with a message while something would be lost by leaving (null = nothing to lose). */
export function useLeaveGuard(reason: string | null) {
  const key = useRef<string>("");
  if (!key.current) key.current = `guard-${++seq}`;

  useEffect(() => {
    const k = key.current;
    setBlocked(k, reason);
    if (!reason) return;
    // also warn before closing / refreshing the tab
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      setBlocked(k, null);
    };
  }, [reason]);
}
