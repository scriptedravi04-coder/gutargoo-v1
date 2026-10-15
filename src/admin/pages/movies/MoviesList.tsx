import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Pager } from "@/components/common/Pager";
import { StatusPill } from "@/components/common/StatusPill";
import { EmptyState } from "@/components/common/EmptyState";
import { api, errorMessage, VideoRef, videoStatusLabel } from "@/lib/api";

interface MovieRow {
  _id: string;
  movieTitle: string;
  verticalPosterUrl?: string;
  releaseYear?: number;
  lang?: string;
  duration?: number;
  movieFile?: VideoRef;
  trailer?: VideoRef;
  customVideoUrl?: string;
  customTrailerUrl?: string;
  subscriptionRequired?: boolean;
  featuredMovie?: boolean;
  allowDownloads?: boolean;
  viewCount?: number;
  publishStatus?: boolean;
}

interface MoviesPage {
  data: MovieRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type StatusFilter = "all" | "published" | "draft";

const LIMIT = 20;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Uploaded Bunny video wins; otherwise a pasted link counts as "Link".
const videoPill = (video?: VideoRef, customUrl?: string) => {
  if (!video?.videoId && customUrl) return { label: "Link", tone: "ok" as const };
  return videoStatusLabel(video);
};

const fmtDuration = (min?: number) => {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function MoviesList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [toDelete, setToDelete] = useState<MovieRow | null>(null);
  const search = useDebounced(searchText.trim(), 400);

  // back to page 1 whenever the filters change
  useEffect(() => setPage(1), [search, status]);

  const queryKey = ["movies", "admin-list", { page, search, status }];
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (search) params.search = search;
      if (status !== "all") params.status = status;
      const res = await api.get("/movies", { params });
      return res.data as MoviesPage;
    },
    placeholderData: keepPreviousData,
  });

  const publish = useMutation({
    mutationFn: async (movie: MovieRow) => (await api.patch(`/movies/${movie._id}/publish`)).data,
    onMutate: async (movie) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<MoviesPage>(queryKey);
      if (previous) {
        qc.setQueryData<MoviesPage>(queryKey, {
          ...previous,
          data: previous.data.map((m) => (m._id === movie._id ? { ...m, publishStatus: !m.publishStatus } : m)),
        });
      }
      return { previous };
    },
    onSuccess: (res) => toast.success(res?.message || "Saved"),
    onError: (err, _movie, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["movies"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/movies/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Movie deleted");
      setToDelete(null);
      // if we just removed the last movie on this page, step back one page
      if (data && data.data.length === 1 && page > 1) setPage(page - 1);
      qc.invalidateQueries({ queryKey: ["movies"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const movies = data?.data || [];
  const pagination = data?.pagination;
  const filtered = !!search || status !== "all";

  const addButton = (
    <Button type="button" onClick={() => navigate("/movies/new")}>
      <Plus className="mr-1 h-4 w-4" /> Add movie
    </Button>
  );

  return (
    <div>
      <PageHeader title="Movies" description="Add, edit and publish the movies shown in the app." actions={addButton} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search by title…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All movies</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Film className="h-8 w-8" />}
          title="Could not load movies"
          description={errorMessage(error)}
          action={
            <Button type="button" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : movies.length === 0 ? (
        <EmptyState
          icon={<Film className="h-8 w-8" />}
          title={filtered ? "No movies match" : "No movies yet"}
          description={filtered ? "Try a different search or filter." : "Add your first movie to get started."}
          action={filtered ? undefined : addButton}
        />
      ) : (
        <>
          <div className={`overflow-x-auto rounded-lg border ${isFetching ? "opacity-70" : ""}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Movie</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Trailer</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movies.map((m) => {
                  const video = videoPill(m.movieFile, m.customVideoUrl);
                  const trailer = videoPill(m.trailer, m.customTrailerUrl);
                  return (
                    <TableRow key={m._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
                            {m.verticalPosterUrl ? (
                              <img src={m.verticalPosterUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Film className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              className="block max-w-[260px] truncate text-left font-medium hover:underline"
                              onClick={() => navigate(`/movies/${m._id}/edit`)}
                            >
                              {m.movieTitle}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {[m.releaseYear, m.lang, fmtDuration(m.duration)].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={video.tone}>{video.label}</StatusPill>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={trailer.tone}>{trailer.tone === "none" ? "None" : trailer.label}</StatusPill>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {m.subscriptionRequired ? <StatusPill tone="wait">Paid</StatusPill> : <StatusPill tone="none">Free</StatusPill>}
                          {m.featuredMovie && <StatusPill tone="ok">Featured</StatusPill>}
                          {m.allowDownloads && <StatusPill tone="none">Downloads</StatusPill>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{(m.viewCount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!m.publishStatus}
                            disabled={publish.isPending && publish.variables?._id === m._id}
                            onCheckedChange={() => publish.mutate(m)}
                            aria-label="Published"
                          />
                          <span className="text-xs text-muted-foreground">{m.publishStatus ? "Live" : "Draft"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => navigate(`/movies/${m._id}/edit`)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setToDelete(m)} aria-label="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {pagination && <Pager page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onPage={setPage} />}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete "${toDelete?.movieTitle || ""}"?`}
        description="This permanently deletes the movie, removes its video and trailer from Bunny, and takes it out of every home section and banner. This cannot be undone."
        confirmLabel="Delete movie"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete._id)}
        onOpenChange={(open) => !open && !remove.isPending && setToDelete(null)}
      />
    </div>
  );
}
