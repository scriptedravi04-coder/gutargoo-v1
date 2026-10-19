// Tiny toast (bottom snackbar like Flutter's).
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [overNav, setOverNav] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    // above the phone tab bar when there is one, otherwise near the bottom edge
    setOverNav(!!document.querySelector("[data-bottom-nav]"));
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(null), 2500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4"
          style={{ bottom: `calc(${overNav ? "5rem" : "1.5rem"} + env(safe-area-inset-bottom, 0px))` }}
          role="status"
          aria-live="polite"
        >
          <div className="animate-pop max-w-[min(92vw,28rem)] rounded-lg bg-[#323232] px-4 py-2.5 text-center text-sm text-white shadow-[0_6px_24px_rgba(0,0,0,.6)]">{msg}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
