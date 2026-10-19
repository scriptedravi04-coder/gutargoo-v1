import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, ImageOff, Pencil, Plus, Search, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Series, SeriesContentType, seriesDetailKey, seriesLabels, seriesListKey } from "@/components/series/shared";

export default function SeriesList({ contentType }: { contentType: SeriesContentType }) {
  const L = seriesLabels(contentType);
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Series | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  // reset the search when switching between Web Series and TV Shows
  useEffect(() => {
    setSearchText("");
    setSearch("");
  }, [contentType]);

  const listQuery = useQuery({
    queryKey: [...seriesListKey(contentType), search],
    queryFn: async () => {
      const { data } = await api.get("/webseries", { params: { contentType, search } });
      return (data.data || []) as Series[];
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (s: Series) => {
      const { data } = await api.patch(`/webseries/${s._id}/publish`);
      return data;
    },
    onMutate: (s) => setTogglingId(s._id),
    onSuccess: (data) => {
      toast.success(data.message || "Saved");
      if (data.data?._id) queryClient.setQueryData(seriesDetailKey(data.data._id), data.data);
      queryClient.invalidateQueries({ queryKey: ["webseries", "list"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (s: Series) => {
      const { data } = await api.delete(`/webseries/${s._id}`);
      return data;
    },
    onSuccess: (data, s) => {
      toast.success(data.message || `${L.One} deleted`);
      setToDelete(null);
      queryClient.removeQueries({ queryKey: seriesDetailKey(s._id) });
      queryClient.invalidateQueries({ queryKey: ["webseries", "list"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = listQuery.data || [];
  const Icon = contentType === "tvshow" ? Tv : Clapperboard;

  return (
    <div>
      <PageHeader
        title={L.Many}
        description={`Add ${L.many}, then add seasons and episodes to each one.`}
        actions={
          <Button asChild>
            <Link to={`${L.base}/new`}>
              <Plus className="h-4 w-4" /> Add {L.one}
            </Link>
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={`Search ${L.many} by title`} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border py-10 text-center">
          <p className="text-sm text-destructive">{errorMessage(listQuery.error)}</p>
          <Button type="button" variant="outline" onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        search ? (
          <EmptyState icon={<Search className="h-8 w-8" />} title="Nothing found" description={`No ${L.many} match "${search}".`} />
        ) : (
          <EmptyState
            icon={<Icon className="h-8 w-8" />}
            title={`No ${L.many} yet`}
            description={`Create your first ${L.one}. After saving it you can add seasons and episodes.`}
            action={
              <Button asChild>
                <Link to={`${L.base}/new`}>
                  <Plus className="h-4 w-4" /> Add {L.one}
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Poster</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="whitespace-nowrap">Seasons / Episodes</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s._id}>
                  <TableCell>
                    <div className="h-16 w-11 overflow-hidden rounded bg-muted">
                      {s.verticalPoster ? (
                        <img src={s.verticalPoster} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <Link to={`${L.base}/${s._id}/edit`} className="font-medium hover:underline">
                      {s.title}
                    </Link>
                    {s.genres && s.genres.length > 0 && <p className="text-xs text-muted-foreground">{s.genres.join(", ")}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {s.total_seasons ?? 0} {s.total_seasons === 1 ? "season" : "seasons"} · {s.total_episodes ?? 0}{" "}
                    {s.total_episodes === 1 ? "episode" : "episodes"}
                  </TableCell>
                  <TableCell className="text-sm">{s.lang || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={s.isPublished !== false}
                        disabled={togglingId === s._id}
                        onCheckedChange={() => publishMutation.mutate(s)}
                        aria-label="Published"
                      />
                      <span className="text-xs text-muted-foreground">{s.isPublished !== false ? "Live" : "Draft"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`${L.base}/${s._id}/edit`}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(s)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete "${toDelete?.title || ""}"?`}
        description={`This deletes the ${L.one} with all its seasons and episodes, and their videos on Bunny. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete)}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setToDelete(null)}
      />
    </div>
  );
}
