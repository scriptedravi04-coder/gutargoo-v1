import { FormEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageOff, Info, Layers, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, videoStatusLabel } from "@/lib/api";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill } from "@/components/common/StatusPill";
import { VideoStatusPill } from "@/components/common/VideoStatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EpisodeDialog } from "./EpisodeDialog";
import { Episode, Season, Series, formatDuration, seriesDetailKey, toDateInput } from "./shared";

interface Props {
  series: Series;
  refreshing: boolean;
  onRefresh: () => void;
}

type DeleteTarget = { kind: "season"; season: Season } | { kind: "episode"; season: Season; episode: Episode } | null;

const seasonName = (s: Season) => (s.title && s.title !== `Season ${s.seasonNumber}` ? `Season ${s.seasonNumber} · ${s.title}` : `Season ${s.seasonNumber}`);

export function SeasonsManager({ series, refreshing, onRefresh }: Props) {
  const queryClient = useQueryClient();
  const seasons = series.seasons || [];

  const [openSeasons, setOpenSeasons] = useState<string[]>(() => (seasons[0] ? [seasons[0]._id] : []));
  const [seasonDialog, setSeasonDialog] = useState<{ open: boolean; season: Season | null }>({ open: false, season: null });
  const [episodeDialog, setEpisodeDialog] = useState<{ open: boolean; seasonId: string | null; episode: Episode | null }>({
    open: false,
    seasonId: null,
    episode: null,
  });
  const [toDelete, setToDelete] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  // open newly added seasons automatically
  const knownIds = useRef<string[]>(seasons.map((s) => s._id));
  useEffect(() => {
    const ids = seasons.map((s) => s._id);
    const added = ids.filter((id) => !knownIds.current.includes(id));
    knownIds.current = ids;
    if (added.length) setOpenSeasons((o) => [...o, ...added]);
  }, [seasons]);

  /** Every season/episode call replies with the full series — put it straight into the cache. */
  const applySeries = (updated: Series) => {
    if (updated?._id) queryClient.setQueryData(seriesDetailKey(updated._id), updated);
    queryClient.invalidateQueries({ queryKey: ["webseries", "list"] });
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const url =
        toDelete.kind === "season"
          ? `/webseries/${series._id}/seasons/${toDelete.season._id}`
          : `/webseries/${series._id}/seasons/${toDelete.season._id}/episodes/${toDelete.episode._id}`;
      const { data } = await api.delete(url);
      applySeries(data.data);
      toast.success(data.message || "Deleted");
      setToDelete(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // the season for the episode dialog is looked up live so "next episode number" stays correct
  const episodeSeason = seasons.find((s) => s._id === episodeDialog.seasonId) || null;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Seasons & episodes</CardTitle>
          <CardDescription>
            {seasons.length} {seasons.length === 1 ? "season" : "seasons"} · {series.total_episodes ?? 0}{" "}
            {series.total_episodes === 1 ? "episode" : "episodes"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setSeasonDialog({ open: true, season: null })}>
            <Plus className="h-4 w-4" /> Add season
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Videos take a few minutes to process on Bunny after upload. This page checks every minute; press Refresh (or ↻ next to “Processing”) to check now.</span>
        </div>

        {seasons.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title="No seasons yet"
            description="Add Season 1 first, then add episodes inside it."
            action={
              <Button type="button" onClick={() => setSeasonDialog({ open: true, season: null })}>
                <Plus className="h-4 w-4" /> Add season
              </Button>
            }
          />
        ) : (
          <Accordion type="multiple" value={openSeasons} onValueChange={setOpenSeasons} className="rounded-lg border">
            {seasons.map((season) => (
              <AccordionItem key={season._id} value={season._id} className="last:border-b-0">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex flex-wrap items-baseline gap-x-3 text-left">
                    <span>{seasonName(season)}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {season.episodes.length} {season.episodes.length === 1 ? "episode" : "episodes"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => setEpisodeDialog({ open: true, seasonId: season._id, episode: null })}>
                      <Plus className="h-4 w-4" /> Add episode
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setSeasonDialog({ open: true, season })}>
                      <Pencil className="h-4 w-4" /> Edit season
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete({ kind: "season", season })}>
                      <Trash2 className="h-4 w-4" /> Delete season
                    </Button>
                  </div>

                  {season.episodes.length === 0 ? (
                    <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No episodes in this season yet.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {season.episodes.map((ep) => {
                        const st = videoStatusLabel(ep.videoFile);
                        const dur = formatDuration(ep.videoFile?.duration);
                        return (
                          <li key={ep._id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="w-7 shrink-0 text-center text-sm font-semibold text-muted-foreground">{ep.episodeNumber}</span>
                              <div className="aspect-video w-24 shrink-0 overflow-hidden rounded bg-muted">
                                {ep.thumbnail ? (
                                  <img src={ep.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <ImageOff className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{ep.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <VideoStatusPill
                                    tone={ep.customVideoUrl && !ep.videoFile?.videoId ? "ok" : st.tone}
                                    label={ep.customVideoUrl && !ep.videoFile?.videoId ? "Link" : st.label}
                                    videoId={ep.videoFile?.videoId}
                                    onChecked={onRefresh}
                                  />
                                  <StatusPill tone={ep.isPublished !== false ? "ok" : "none"}>{ep.isPublished !== false ? "Published" : "Hidden"}</StatusPill>
                                  {dur && <span className="text-xs text-muted-foreground">{dur}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEpisodeDialog({ open: true, seasonId: season._id, episode: ep })}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                aria-label="Delete episode"
                                onClick={() => setToDelete({ kind: "episode", season, episode: ep })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      <SeasonDialog
        open={seasonDialog.open}
        season={seasonDialog.season}
        series={series}
        onOpenChange={(open) => setSeasonDialog((d) => ({ ...d, open }))}
        onSaved={applySeries}
      />

      <EpisodeDialog
        open={episodeDialog.open}
        onOpenChange={(open) => setEpisodeDialog((d) => ({ ...d, open }))}
        seriesId={series._id}
        seriesTitle={series.title}
        season={episodeSeason}
        episode={episodeDialog.episode}
        onSaved={applySeries}
      />

      <ConfirmDialog
        open={!!toDelete}
        title={
          toDelete?.kind === "season"
            ? `Delete ${seasonName(toDelete.season)}?`
            : toDelete?.kind === "episode"
            ? `Delete episode ${toDelete.episode.episodeNumber}?`
            : ""
        }
        description={
          toDelete?.kind === "season"
            ? `All ${toDelete.season.episodes.length} episode(s) in this season and their videos on Bunny will be deleted too. This cannot be undone.`
            : toDelete?.kind === "episode"
            ? `"${toDelete.episode.title}" and its video on Bunny will be deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onOpenChange={(o) => !o && !deleting && setToDelete(null)}
      />
    </Card>
  );
}

/* ───────── Add / edit season ───────── */

function SeasonDialog({
  open,
  season,
  series,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  season: Season | null;
  series: Series;
  onOpenChange: (open: boolean) => void;
  onSaved: (s: Series) => void;
}) {
  const seasons = series.seasons || [];
  const [seasonNumber, setSeasonNumber] = useState("");
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (season) {
      setSeasonNumber(String(season.seasonNumber));
      setTitle(season.title && season.title !== `Season ${season.seasonNumber}` ? season.title : "");
      setReleaseDate(toDateInput(season.releaseDate));
    } else {
      setSeasonNumber(String(Math.max(0, ...seasons.map((s) => s.seasonNumber || 0)) + 1));
      setTitle("");
      setReleaseDate("");
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, season?._id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(seasonNumber);
    if (!seasonNumber || !Number.isInteger(n) || n < 1) return setError("Season number must be a whole number like 1, 2, 3.");
    if (seasons.some((s) => s.seasonNumber === n && s._id !== season?._id)) return setError(`Season ${n} already exists.`);
    setError("");
    setSaving(true);
    try {
      const body = { seasonNumber: n, title: title.trim() || `Season ${n}`, releaseDate: releaseDate || "" };
      const { data } = season
        ? await api.put(`/webseries/${series._id}/seasons/${season._id}`, body)
        : await api.post(`/webseries/${series._id}/seasons`, body);
      onSaved(data.data);
      toast.success(data.message || "Season saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{season ? `Edit season ${season.seasonNumber}` : "Add season"}</DialogTitle>
          <DialogDescription>{series.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="season-number">Season number *</Label>
            <Input id="season-number" type="number" min={1} step={1} value={seasonNumber} onChange={(e) => setSeasonNumber(e.target.value)} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="season-title">Season name</Label>
            <Input id="season-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Season ${seasonNumber || ""}`.trim()} />
            <p className="text-xs text-muted-foreground">Optional. If empty, it is called "Season {seasonNumber || "N"}".</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="season-date">Release date</Label>
            <Input id="season-date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : season ? "Save season" : "Add season"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
