// Tiny toast (bottom snackbar like Flutter's).
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(null), 2500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="animate-pop rounded-lg bg-[#323232] px-4 py-2.5 text-sm text-white shadow-lg">{msg}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
