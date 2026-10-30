// Keeps "premium on this number" up to date for the whole site (and resets it on sign-out).
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";
import { setPro } from "./pro";

export function ProSync() {
  const { isLoggedIn, token } = useAuth();
  const { data } = useQuery({
    queryKey: ["customer-profile-pro", token],
    enabled: isLoggedIn,
    queryFn: async () => (await api.get<{ data?: { isPremiusm?: boolean; subscriptionExpiry?: string | null } }>("/customer/profile")).data?.data || {},
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (!isLoggedIn) return setPro(false);
    if (data) setPro(!!data.isPremiusm || (!!data.subscriptionExpiry && new Date(data.subscriptionExpiry).getTime() > Date.now()));
  }, [isLoggedIn, data]);
  return null;
}
