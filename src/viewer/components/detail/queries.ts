// Shared react-query hooks for one movie / one series (same cache for details and player).
import { useQuery } from "@tanstack/react-query";
import { api, ApiMovie, ApiSeries } from "@v/lib/api";
import { fromMovie, fromSeries } from "@v/lib/content";

const FIVE_MIN = 5 * 60 * 1000;
const notFound = () => Object.assign(new Error("Not found"), { response: { status: 404 } });
const selectMovie = (r: { data: ApiMovie }) => fromMovie(r.data);
const selectSeries = (r: { data: ApiSeries }) => fromSeries(r.data);

export const useMovieQuery = (id: string, enabled = true) =>
  useQuery({
    queryKey: ["movie", id],
    queryFn: async () => {
      const r = (await api.get<{ data: ApiMovie }>(`/movies/${id}`)).data;
      if (!r?.data) throw notFound();
      return r;
    },
    select: selectMovie,
    enabled: enabled && !!id,
    staleTime: FIVE_MIN,
  });

export const useSeriesQuery = (id: string, enabled = true) =>
  useQuery({
    queryKey: ["series", id],
    queryFn: async () => {
      const r = (await api.get<{ data: ApiSeries }>(`/webseries/${id}`)).data;
      if (!r?.data) throw notFound();
      return r;
    },
    select: selectSeries,
    enabled: enabled && !!id,
    staleTime: FIVE_MIN,
  });
