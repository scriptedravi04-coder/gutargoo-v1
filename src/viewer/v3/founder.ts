// "Free Premium for the first 1000" — live spots from the server (Admin → Home Settings controls it).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@v/lib/api";
import { useAuth } from "@v/lib/auth";

export interface FounderInfo {
  active: boolean;
  limit: number;
  claimed: number;
  left: number;
  days: number;
  isFounder?: boolean;
}

export const daysText = (d: number) => (d >= 360 ? (Math.round(d / 365) > 1 ? `${Math.round(d / 365)} years` : "1 year") : d >= 28 ? `${Math.round(d / 30)} month${Math.round(d / 30) > 1 ? "s" : ""}` : `${d} days`);

export function useFounder() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["founder", token],
    queryFn: async () => (await api.get<{ data: FounderInfo }>("/founder")).data?.data,
    staleTime: 60 * 1000,
    retry: 0,
  });
}

export function useClaimFounder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ success?: boolean; message?: string; data?: { subscriptionExpiry?: string; spot?: number } }>("/founder/claim")).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["founder"] });
      qc.invalidateQueries({ queryKey: ["customer-profile"] });
      qc.invalidateQueries({ queryKey: ["customer-profile-pro"] });
    },
  });
}
