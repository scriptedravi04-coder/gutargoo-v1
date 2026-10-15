// Login state for app users (mobile OTP), shared by every screen.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "./storage";

interface AuthState {
  token: string | null;
  mobile: string | null; // "91XXXXXXXXXX"
  isLoggedIn: boolean;
  login: (token: string, mobile: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(storage.getToken());
  const [mobile, setMobile] = useState(storage.getMobile());

  // the API layer signs out on an expired token
  useEffect(() => {
    const sync = () => {
      setToken(storage.getToken());
      setMobile(storage.getMobile());
    };
    window.addEventListener("gp-auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gp-auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const login = useCallback((t: string, m: string) => {
    storage.setAuth(t, m);
    setToken(t);
    setMobile(m);
  }, []);
  const logout = useCallback(() => {
    storage.clearAuth();
    storage.setProfile({}); // next person on this device starts clean
    setToken(null);
    setMobile(null);
  }, []);

  return <AuthContext.Provider value={{ token, mobile, isLoggedIn: !!token, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

/** "919876543210" → "+91 98765 43210" */
export const prettyMobile = (m?: string | null) => {
  const d = String(m || "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : "";
};
