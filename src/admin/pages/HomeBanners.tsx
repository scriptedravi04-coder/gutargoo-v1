import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Film, ImageIcon, Loader2, Pencil, Plus, RefreshCw, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, toFormData } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ImagePicker } from "@/components/common/ImagePicker";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContentCombobox } from "@/components/home/ContentCombobox";
import { movieToItem, seriesKindLabel, seriesToItem, useMovieOptions, useSeriesOptions } from "@/components/home/contentOptions";

type BannerType = "single_movie" | "web_series";

interface Banner {
  _id: string;
  title: string;
  description?: string;
  /** picture the app shows (own picture, or the linked movie / series banner) */
  bannerImage?: string;
  /** picture uploaded for this banner ("" = uses the movie / series banner; missing on older servers) */
  ownBannerImage?: string;
  ownMobileImage?: string;
  logoImage?: string;
  bannerType: BannerType;
  movieId?: { _id: string; movieTitle?: string } | string | null;
  webseriesId?: { _id: string; title?: string; contentType?: string } | string | null;
  publishStatus?: boolean;
  displayOrder?: number;
  /** false when the linked movie is a draft / scheduled / expired or the series is unpublished (newer servers) */
  linkedVisible?: boolean;
}

const KEY = ["banners"];

const idOf = (v: Banner["movieId"] | Banner["webseriesId"]) => (!v ? "" : typeof v === "string" ? v : v._id || "");

/** What a banner opens, for the list. */
const linkedContent = (b: Banner): { label: string; kind: string } | null => {
  if (b.bannerType === "web_series") {
    const s = b.webseriesId;
    if (s && typeof s === "object" && s.title) return { label: s.title, kind: seriesKindLabel(s.contentType) };
    return null;
  }
  const m = b.movieId;
  if (m && typeof m === "object" && m.movieTitle) return { label: m.movieTitle, kind: "Movie" };
  return null;
};

export default function HomeBanners() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: KEY,
    queryFn: async () => ((await api.get("/banners")).data.data || []) as Banner[],
  });
  const banners = list.data || [];

  const togglePublish = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/banners/${id}/toggle-publish`)).data,
    onMutate: (id) => setTogglingId(id),
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setTogglingId(null),
  });

  const reorder = useMutation({
    mutationFn: async (ordered: Banner[]) => (await api.put("/banners/reorder", { ids: ordered.map((b) => b._id) })).data,
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Banner[]>(KEY);
      qc.setQueryData(KEY, ordered);
      return { previous };
    },
    onSuccess: (data) => toast.success(data?.message || "Order saved"),
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/banners/${id}`)).data,
    onSuccess: (data) => {
      toast.success(data?.message || "Banner deleted");
      qc.invalidateQueries({ queryKey: KEY });
      setToDelete(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= banners.length) return;
    const next = [...banners];
    [next[index], next[to]] = [next[to], next[index]];
    reorder.mutate(next);
  };

  const openForm = (b: Banner | null) => {
    setEditing(b);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Home Banners"
        description="The big slides at the top of the app's home screen. They show in this order."
        actions={
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-1" /> Add banner
          </Button>
        }
      />

      {list.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Could not load banners"
          description={errorMessage(list.error)}
          action={
            <Button type="button" variant="outline" onClick={() => list.refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          }
        />
      ) : banners.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-8 w-8" />}
          title="No banners yet"
          description="Add a banner to feature a movie or web series at the top of the home screen."
          action={
            <Button type="button" onClick={() => openForm(null)}>
              <Plus className="h-4 w-4 mr-1" /> Add banner
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {banners.map((b, i) => {
            const linked = linkedContent(b);
            return (
              <Card key={b._id}>
                <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
                    {b.bannerImage ? (
                      <img src={b.bannerImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    {b.logoImage && (
                      <img src={b.logoImage} alt="" className="absolute bottom-1.5 left-1.5 max-h-8 max-w-[60%] object-contain drop-shadow" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                      <p className="truncate font-medium">{b.title}</p>
                      {!b.publishStatus ? (
                        <StatusPill tone="none">Hidden</StatusPill>
                      ) : b.linkedVisible === false ? (
                        <StatusPill tone="wait">Hidden – linked content not live</StatusPill>
                      ) : (
                        <StatusPill tone="ok">Shown</StatusPill>
                      )}
                    </div>
                    {linked ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {b.bannerType === "web_series" ? <Tv className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                        Opens {linked.kind.toLowerCase()}: <span className="truncate text-foreground">{linked.label}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-destructive">Not linked to any content – edit it and choose what it opens.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!b.publishStatus}
                        disabled={togglingId === b._id}
                        onCheckedChange={() => togglePublish.mutate(b._id)}
                        aria-label="Show in app"
                      />
                      Show
                    </label>
                    <div className="flex items-center">
                      <Button type="button" variant="ghost" size="icon" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={i === banners.length - 1 || reorder.isPending}
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => openForm(b)} aria-label="Edit banner">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setToDelete(b)} aria-label="Delete banner">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BannerFormDialog open={formOpen} onOpenChange={setFormOpen} banner={editing} />

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete banner "${toDelete?.title}"?`}
        description="The banner and its images will be removed from the app. The movie or series itself is not affected."
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete._id)}
        onOpenChange={(o) => !o && !remove.isPending && setToDelete(null)}
      />
    </div>
  );
}

/* ───────── Add / edit dialog ───────── */

function BannerFormDialog({ open, onOpenChange, banner }: { open: boolean; onOpenChange: (o: boolean) => void; banner: Banner | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-y-auto">
        {/* key resets the form every time it opens */}
        {open && <BannerForm key={banner?._id || "new"} banner={banner} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function BannerForm({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(banner?.title || "");
  const [description, setDescription] = useState(banner?.description || "");
  const [bannerType, setBannerType] = useState<BannerType>(banner?.bannerType === "web_series" ? "web_series" : "single_movie");
  const [movieId, setMovieId] = useState(idOf(banner?.movieId));
  const [webseriesId, setWebseriesId] = useState(idOf(banner?.webseriesId));
  const [publishStatus, setPublishStatus] = useState(banner ? !!banner.publishStatus : true);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeOwnImage, setRemoveOwnImage] = useState(false);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [error, setError] = useState("");
  // newer servers use the movie / series banner when no own picture is uploaded
  const fallbackSupported = !banner || banner.ownBannerImage !== undefined;
  const ownImage = banner ? (banner.ownBannerImage !== undefined ? banner.ownBannerImage : banner.bannerImage) || "" : "";

  const movies = useMovieOptions(bannerType === "single_movie");
  const series = useSeriesOptions(bannerType === "web_series");
  const movieItems = useMemo(() => (movies.data || []).map(movieToItem), [movies.data]);
  const seriesItems = useMemo(() => (series.data || []).map(seriesToItem), [series.data]);

  const linked = banner ? linkedContent(banner) : null;

  const save = useMutation({
    mutationFn: async () => {
      const fd = toFormData({
        title: title.trim(),
        description: description.trim(),
        bannerType,
        movieId: bannerType === "single_movie" ? movieId : undefined,
        webseriesId: bannerType === "web_series" ? webseriesId : undefined,
        publishStatus,
        bannerImage: bannerFile || undefined,
        logoImage: logoFile || undefined,
        removeLogoImage: banner && removeLogo && !logoFile ? true : undefined,
        removeBannerImage: banner && removeOwnImage && !bannerFile ? true : undefined,
        mobileImage: mobileFile || undefined,
        removeMobileImage: banner && removeMobile && !mobileFile ? true : undefined,
      });
      const res = banner ? await api.put(`/banners/${banner._id}`, fd) : await api.post("/banners", fd);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: KEY });
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Please enter a title.");
    if (bannerType === "single_movie" && !movieId) return setError("Please choose the movie this banner opens.");
    if (bannerType === "web_series" && !webseriesId) return setError("Please choose the web series or TV show this banner opens.");
    // newer servers: no picture = the movie / series banner is used (the server says if that one is missing too)
    if (!fallbackSupported && !bannerFile && !ownImage) return setError("Please choose a banner image.");
    setError("");
    save.mutate();
  };

  const selectedDraft =
    bannerType === "single_movie" ? movieItems.find((m) => m._id === movieId && !m.published) : seriesItems.find((s) => s._id === webseriesId && !s.published);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{banner ? "Edit banner" : "Add banner"}</DialogTitle>
        <DialogDescription>Tapping the banner in the app opens the movie or series you choose here.</DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="bn-title">Title *</Label>
        <Input id="bn-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New this week" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bn-desc">Description</Label>
        <Textarea id="bn-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short line shown on the banner (optional)" />
      </div>

      <div className="space-y-2">
        <Label>What does it open? *</Label>
        <RadioGroup value={bannerType} onValueChange={(v) => setBannerType(v as BannerType)} className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="single_movie" /> Movie
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="web_series" /> Web series or TV show
          </label>
        </RadioGroup>

        {bannerType === "single_movie" ? (
          movies.isError ? (
            <LoadError message={errorMessage(movies.error)} onRetry={() => movies.refetch()} />
          ) : (
            <ContentCombobox
              items={movieItems}
              value={movieId}
              onChange={setMovieId}
              loading={movies.isLoading}
              placeholder="Choose a movie"
              searchPlaceholder="Search movies…"
              emptyText="No movie found."
              fallbackLabel={banner?.bannerType === "single_movie" ? linked?.label : undefined}
            />
          )
        ) : series.isError ? (
          <LoadError message={errorMessage(series.error)} onRetry={() => series.refetch()} />
        ) : (
          <ContentCombobox
            items={seriesItems}
            value={webseriesId}
            onChange={setWebseriesId}
            loading={series.isLoading}
            placeholder="Choose a web series or TV show"
            searchPlaceholder="Search series…"
            emptyText="No series found."
            fallbackLabel={banner?.bannerType === "web_series" ? linked?.label : undefined}
          />
        )}
        {selectedDraft && <p className="text-xs text-amber-600">This title is a draft, so it is hidden in the app. Publish it first, or users can't open it.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <ImagePicker
            label={fallbackSupported ? "Banner image" : "Banner image *"}
            hint="Landscape 16:9, best 1920 × 1080. Used in the mobile app and on computers — keep faces and text in the middle."
            aspect="landscape"
            value={ownImage || undefined}
            file={bannerFile}
            onChange={setBannerFile}
            removed={banner && fallbackSupported ? removeOwnImage : undefined}
            onRemoveChange={banner && fallbackSupported ? setRemoveOwnImage : undefined}
          />
          {fallbackSupported && !bannerFile && (!ownImage || removeOwnImage) && (
            <p className="text-xs text-muted-foreground">No picture chosen → the movie / series' own banner picture is used.</p>
          )}
        </div>
        <ImagePicker
          label="Website phone picture (optional)"
          hint="Tall picture (about 4:5, e.g. 1080 × 1350) for the website on phones. Empty = the banner image above is used."
          aspect="portrait"
          value={banner?.ownMobileImage || undefined}
          file={mobileFile}
          onChange={setMobileFile}
          removed={banner ? removeMobile : undefined}
          onRemoveChange={banner ? setRemoveMobile : undefined}
        />
        <ImagePicker
          label="Title logo"
          hint="Optional. A wide PNG with a transparent background, shown over the banner."
          aspect="wide"
          value={banner?.logoImage || undefined}
          file={logoFile}
          onChange={setLogoFile}
          removed={banner ? removeLogo : undefined}
          onRemoveChange={banner ? setRemoveLogo : undefined}
        />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Show in app</span>
          <span className="block text-xs text-muted-foreground">Turn off to keep the banner saved but hidden.</span>
        </span>
        <Switch checked={publishStatus} onCheckedChange={setPublishStatus} />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 gap-2 border-t bg-background px-6 py-3">
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {banner ? "Save changes" : "Add banner"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 p-2 text-sm text-destructive">
      <span>Could not load the list: {message}</span>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
