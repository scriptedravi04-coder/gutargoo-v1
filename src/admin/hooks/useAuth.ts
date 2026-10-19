import { useState, useEffect, useCallback } from "react";
import { api, TOKEN_KEY, USER_KEY, errorMessage } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export type User = {
  id: string;
  name?: string;
  email: string;
  role?: string;
};

// JWT expiry check without a library
const tokenExpired = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    // no expiry inside the token → let the server decide (it answers 401 when it's invalid)
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
};

const readUser = (): User | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw || tokenExpired(token)) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(readUser);
  const [loading] = useState(false);

  // drop an expired session right away
  useEffect(() => {
    if (!user) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post("/auth/login", { email: email.trim(), password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (err) {
      throw new Error(errorMessage(err, "Wrong email or password"));
    }
  }, []);

  const queryClient = useQueryClient();
  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    // drop every cached admin list so the next login never sees the previous session's data
    queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient]);

  return { user, session: user ? { user } : null, loading, signIn, signOut, isAuthenticated: !!user };
}
