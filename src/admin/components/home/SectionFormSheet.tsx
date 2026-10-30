import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SectionContentPicker } from "./SectionContentPicker";
import { PickedItem, seriesKindLabel, urlOf } from "./contentOptions";

export type ContentSource = "admin_selected" | "recently_added" | "most_viewed" | "watch_time_based" | "auto";
export type DisplayStyle = "vertical_banner" | "horizontal_banner" | "big_vertical" | "big_horizontal" | "index_vertical" | "index_horizontal";

export interface HomeSection {
  _id: string;
  title: string;
  contentSource: ContentSource;
  displayStyle: DisplayStyle;
  isActive?: boolean;
  categoryId?: { _id: string; name: string; categoryType: string } | null;
  itemLimit?: number;
  trendingPeriodDays?: number;
  displayOrder?: number;
  sectionData?: {
    movies?: { _id: string; movieTitle?: string; verticalPoster?: { url?: string } | string; publishStatus?: boolean }[];
    webseries?: { _id: string; title?: string; verticalPoster?: unknown; thumbnail?: unknown; contentType?: string; isPublished?: boolean }[];
  };
}

export const SOURCE_LABELS: Record<ContentSource, string> = {
  admin_selected: "Hand-picked",
  recently_added: "Newest first",
  most_viewed: "Most viewed",
  watch_time_based: "Most watched (last N days)",
  auto: "Hand-picked, or newest if empty",
};

const SOURCE_HELP: Record<ContentSource, string> = {
  admin_selected: "You choose exactly which titles show, and in what order.",
  recently_added: "Fills itself with the newest published titles.",
  most_viewed: "Fills itself with the most viewed titles of all time.",
  watch_time_based: "Fills itself with the titles watched the most in the last few days.",
  auto: "Shows your picks. If you pick nothing, it shows the newest titles instead.",
};

export const STYLE_LABELS: Record<DisplayStyle, string> = {
  vertical_banner: "Posters (portrait)",
  horizontal_banner: "Landscape cards",
  big_vertical: "Big posters",
  big_horizontal: "Big landscape",
  index_vertical: "Top 10 (numbered)",
  index_horizontal: "Top 10 landscape",
};

const STYLE_HELP: Record<DisplayStyle, string> = {
  vertical_banner: "Normal row of portrait posters (2:3). Uses each title's poster.",
  horizontal_banner: "Row of wide cards (16:9). Uses each title's landscape banner.",
  big_vertical: "Larger portrait posters — good for a featured row.",
  big_horizontal: "Large wide cards — good for a featured row.",
  index_vertical: "Numbered 1–10 portrait posters. Shows at most 10 titles.",
  index_horizontal: "Numbered 1–10 wide cards. Shows at most 10 titles.",
};

const NONE = "none";

interface Category {
  _id: string;
  name: string;
  categoryType: string;
}
const CATEGORY_TYPE: Record<string, string> = { movie: "Movies", webseries: "Web Series", tvshows: "TV Shows" };

export function SectionFormSheet({ open, onOpenChange, section }: { open: boolean; onOpenChange: (o: boolean) => void; section: HomeSection | null }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {open && <SectionForm key={section?._id || "new"} section={section} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

const moviesFrom = (s: HomeSection | null): PickedItem[] =>
  (s?.sectionData?.movies || [])
    .filter((m) => m && typeof m === "object" && m._id)
    .map((m) => ({ _id: m._id, title: m.movieTitle || "Untitled movie", posterUrl: urlOf(m.verticalPoster), published: m.publishStatus !== false }));

const seriesFrom = (s: HomeSection | null): PickedItem[] =>
  (s?.sectionData?.webseries || [])
    .filter((w) => w && typeof w === "object" && w._id)
    .map((w) => ({
      _id: w._id,
      title: w.title || "Untitled series",
      posterUrl: urlOf(w.verticalPoster) || urlOf(w.thumbnail),
      published: w.isPublished !== false,
      subtitle: seriesKindLabel(w.contentType),
    }));

function SectionForm({ section, onDone }: { section: HomeSection | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(section?.title || "");
  const [contentSource, setContentSource] = useState<ContentSource>(section?.contentSource || "admin_selected");
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>(section?.displayStyle || "vertical_banner");
  const [categoryId, setCategoryId] = useState(section?.categoryId?._id || NONE);
  const [itemLimit, setItemLimit] = useState(String(section?.itemLimit ?? 20));
  const [days, setDays] = useState(String(section?.trendingPeriodDays ?? 7));
  const [isActive, setIsActive] = useState(section ? section.isActive !== false : true);
  const [movies, setMovies] = useState<PickedItem[]>(() => moviesFrom(section));
  const [webseries, setWebseries] = useState<PickedItem[]>(() => seriesFrom(section));
  const [error, setError] = useState("");

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => ((await api.get("/category")).data.data || []) as Category[],
  });

  const usesPicks = contentSource === "admin_selected" || contentSource === "auto";
  const isTop10 = displayStyle === "index_vertical" || displayStyle === "index_horizontal";
  const pickedCount = movies.length + webseries.length;
  // the limit is only used when the app fills the row by itself
  const showLimit = contentSource !== "admin_selected";

  const validLimit = (v: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 50;
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        contentSource,
        displayStyle,
        categoryId: categoryId === NONE ? null : categoryId,
        // hidden limit field → send it only if valid, else keep the saved value (or the default)
        itemLimit: showLimit || validLimit(itemLimit) ? Number(itemLimit) : section?.itemLimit ?? 20,
        trendingPeriodDays: Number(days),
        isActive,
        sectionData: { movies: movies.map((m) => m._id), webseries: webseries.map((w) => w._id) },
      };
      const res = section ? await api.put(`/admin/sections/${section._id}`, body) : await api.post("/admin/sections", body);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Saved");
      qc.invalidateQueries({ queryKey: ["sections"] });
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Please enter a section title.");
    const limit = Number(itemLimit);
    if (showLimit && (!Number.isInteger(limit) || limit < 1 || limit > 50)) return setError("Number of items must be a whole number from 1 to 50.");
    const d = Number(days);
    if (contentSource === "watch_time_based" && (!Number.isInteger(d) || d < 1 || d > 365)) return setError("Number of days must be a whole number from 1 to 365.");
    setError("");
    save.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SheetHeader>
        <SheetTitle>{section ? "Edit section" : "Add section"}</SheetTitle>
        <SheetDescription>A section is one row of titles on the app's home screen.</SheetDescription>
      </SheetHeader>

      <div className="space-y-1.5">
        <Label htmlFor="sec-title">Title *</Label>
        <Input id="sec-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Trending now" />
        <p className="text-xs text-muted-foreground">Shown above the row in the app.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Where do the titles come from?</Label>
        <Select value={contentSource} onValueChange={(v) => setContentSource(v as ContentSource)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SOURCE_LABELS) as ContentSource[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SOURCE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{SOURCE_HELP[contentSource]}</p>
      </div>

      <div className="space-y-1.5">
        <Label>Look</Label>
        <Select value={displayStyle} onValueChange={(v) => setDisplayStyle(v as DisplayStyle)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STYLE_LABELS) as DisplayStyle[]).map((k) => (
              <SelectItem key={k} value={k}>
                {STYLE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{STYLE_HELP[displayStyle] || ""}</p>
        {isTop10 && pickedCount > 10 && usesPicks && <p className="text-xs text-amber-600">You picked {pickedCount} titles — only the first 10 show in a Top 10 row.</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder={categories.isLoading ? "Loading…" : "No category"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No category</SelectItem>
            {(categories.data || []).map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name} ({CATEGORY_TYPE[c.categoryType] || c.categoryType})
              </SelectItem>
            ))}
            {/* keep showing the saved category even if the list failed to load */}
            {section?.categoryId && !(categories.data || []).some((c) => c._id === section.categoryId?._id) && (
              <SelectItem value={section.categoryId._id}>{section.categoryId.name}</SelectItem>
            )}
          </SelectContent>
        </Select>
        {categories.isError && (
          <p className="text-xs text-destructive">
            Could not load categories.{" "}
            <button type="button" className="underline" onClick={() => categories.refetch()}>
              Retry
            </button>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Optional. For automatic sections, choosing a Web Series / TV Shows category fills the row with series instead of movies.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {showLimit && (
          <div className="space-y-1.5">
            <Label htmlFor="sec-limit">Number of items</Label>
            <Input id="sec-limit" type="number" min={1} max={50} step={1} value={itemLimit} onChange={(e) => setItemLimit(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {contentSource === "auto" ? "Used only when the row fills itself with the newest titles." : "How many titles the row shows (1–50)."}
            </p>
          </div>
        )}
        {contentSource === "watch_time_based" && (
          <div className="space-y-1.5">
            <Label htmlFor="sec-days">Look at the last … days</Label>
            <Input id="sec-days" type="number" min={1} max={365} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <p className="text-xs text-muted-foreground">e.g. 7 = most watched this week.</p>
          </div>
        )}
      </div>

      {usesPicks && (
        <>
          <SectionContentPicker movies={movies} webseries={webseries} onMoviesChange={setMovies} onWebseriesChange={setWebseries} />
          {contentSource === "admin_selected" && pickedCount === 0 && (
            <p className="text-xs text-amber-600">Nothing picked yet. Empty sections are hidden in the app.</p>
          )}
        </>
      )}

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span>
          <span className="block text-sm font-medium">Show in app</span>
          <span className="block text-xs text-muted-foreground">Turn off to keep the section saved but hidden.</span>
        </span>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {section ? "Save changes" : "Add section"}
        </Button>
      </div>
    </form>
  );
}
