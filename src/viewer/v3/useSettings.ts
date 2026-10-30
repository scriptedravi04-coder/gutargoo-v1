// Home & app settings from the admin panel (Home Settings page).
import { useQuery } from "@tanstack/react-query";
import { api } from "@v/lib/api";

export interface HomeSettings {
  bannerLimit: number;
  bannerAutoSlideSeconds: number;
  showContinueWatching: boolean;
  showTop10: boolean;
  potliCtaSeconds: number;
  supportEmail?: string;
  supportWhatsapp?: string;
}

const DEFAULTS: HomeSettings = { bannerLimit: 6, bannerAutoSlideSeconds: 5, showContinueWatching: true, showTop10: true, potliCtaSeconds: 15 };

export function useHomeSettings(): HomeSettings {
  const { data } = useQuery({
    queryKey: ["settings-home"],
    queryFn: async () => (await api.get<{ data: Partial<HomeSettings> }>("/settings/home")).data?.data || {},
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
  const d = { ...DEFAULTS, ...(data || {}) };
  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  return {
    ...d,
    bannerLimit: num(d.bannerLimit, 6, 1, 20),
    bannerAutoSlideSeconds: num(d.bannerAutoSlideSeconds, 5, 0, 120),
    potliCtaSeconds: num(d.potliCtaSeconds, 15, 0, 60),
    showContinueWatching: d.showContinueWatching !== false,
    showTop10: d.showTop10 !== false,
  };
}
