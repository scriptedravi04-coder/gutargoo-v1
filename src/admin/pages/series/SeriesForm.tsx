import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, toFormData } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { ImagePicker } from "@/components/common/ImagePicker";
import { VideoUploadField } from "@/components/common/VideoUploadField";
import { TagInput } from "@/components/common/TagInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SeasonsManager } from "@/components/series/SeasonsManager";
import {
  PersonRef,
  Series,
  SeriesContentType,
  fetchSeries,
  hasProcessingVideo,
  idOf,
  isValidUrl,
  seriesDetailKey,
  seriesLabels,
  toDateInput,
} from "@/components/series/shared";

const LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Bengali", "Marathi", "Punjabi", "Gujarati", "Kannada", "Malayalam", "Bhojpuri", "Other"];
const AGE_RATINGS = ["U", "U/A 7+", "U/A 13+", "U/A 16+", "A"];
const GENRE_SUGGESTIONS = [
  "Drama",
  "Comedy",
  "Romance",
  "Thriller",
  "Crime",
  "Action",
  "Horror",
  "Mystery",
  "Family",
  "Suspense",
  "Adventure",
  "Fantasy",
  "Mythology",
  "Biography",
  "Documentary",
  "Reality",
];
const NONE = "__none";

interface Details {
  title: string;
  description: string;
  genres: string[];
  lang: string;
  ageRating: string;
  imdbRating: string;
  releaseDate: string;
  category: string;
  isPublished: boolean;
  subscriptionRequired: boolean;
  castAndCrew: string[];
  customTrailerUrl: string;
}

const emptyDetails: Details = {
  title: "",
  description: "",
  genres: [],
  lang: "Hindi",
  ageRating: "",
  imdbRating: "",
  releaseDate: "",
  category: "",
  isPublished: false,
  subscriptionRequired: false,
  castAndCrew: [],
  customTrailerUrl: "",
};

const fromSeries = (s: Series): Details => ({
  title: s.title || "",
  description: s.description || "",
  genres: s.genres || [],
  lang: s.lang || "Hindi",
  ageRating: s.ageRating || "",
  imdbRating: s.imdbRating ? String(s.imdbRating) : "",
  releaseDate: toDateInput(s.releaseDate),
  category: idOf(s.category),
  isPublished: s.isPublished !== false,
  subscriptionRequired: !!s.subscriptionRequired,
  castAndCrew: (s.castAndCrew || []).map(idOf).filter(Boolean),
  customTrailerUrl: s.customTrailerUrl || "",
});

interface Category {
  _id: string;
  name: string;
  categoryType: string;
}

export default function SeriesForm({ contentType }: { contentType: SeriesContentType }) {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const L = seriesLabels(contentType);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [details, setDetails] = useState<Details>(emptyDetails);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [trailerVideoId, setTrailerVideoId] = useState<string | null>(null);
  const [removeTrailer, setRemoveTrailer] = useState(false);
  const [trailerUploading, setTrailerUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<string>((location.state as { tab?: string } | null)?.tab === "seasons" ? "seasons" : "details");
  const initializedFor = useRef<string | null>(null);

  const seriesQuery = useQuery({
    queryKey: seriesDetailKey(id || "new"),
    queryFn: () => fetchSeries(id),
    enabled: isEdit,
    // keep video status fresh while Bunny is still processing something
    refetchInterval: (query) => (hasProcessingVideo(query.state.data as Series) ? 60000 : false),
  });
  const series = seriesQuery.data;

  const categoriesQuery = useQuery({
    queryKey: ["category", contentType === "tvshow" ? "tvshows" : "webseries"],
    queryFn: async () => {
      const categoryType = contentType === "tvshow" ? "tvshows" : "webseries";
      const { data } = await api.get("/category", { params: { categoryType } });
      return ((data.data || []) as Category[]).filter((c) => c.categoryType === categoryType);
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["castAndCrew", "all"],
    queryFn: async () => {
      const { data } = await api.get("/castAndCrew/getAll");
      return (data.data || []) as PersonRef[];
    },
  });

  // fill the form once per series (later cache updates from seasons/episodes must not wipe unsaved edits)
  useEffect(() => {
    if (!isEdit) {
      if (initializedFor.current !== "new") {
        initializedFor.current = "new";
        setDetails(emptyDetails);
        resetFiles();
      }
      return;
    }
    if (series && initializedFor.current !== id) {
      initializedFor.current = id;
      setDetails(fromSeries(series));
      resetFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id, series]);

  function resetFiles() {
    setPosterFile(null);
    setBannerFile(null);
    setThumbFile(null);
    setTrailerVideoId(null);
    setRemoveTrailer(false);
    setErrors({});
  }

  const set = <K extends keyof Details>(key: K, value: Details[K]) => setDetails((d) => ({ ...d, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!details.title.trim()) e.title = "Please enter a title.";
    if (details.imdbRating) {
      const r = Number(details.imdbRating);
      if (!Number.isFinite(r) || r < 0 || r > 10) e.imdbRating = "Rating must be between 0 and 10, e.g. 7.5";
    }
    if (details.customTrailerUrl.trim() && !isValidUrl(details.customTrailerUrl)) e.customTrailerUrl = "The link must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (saving || trailerUploading) return;
    if (!validate()) {
      setTab("details");
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const fd = toFormData({
        title: details.title.trim(),
        description: details.description.trim(),
        genres: details.genres,
        lang: details.lang,
        ageRating: details.ageRating,
        imdbRating: details.imdbRating ? Number(details.imdbRating) : 0,
        releaseDate: details.releaseDate,
        contentType,
        isPublished: details.isPublished,
        subscriptionRequired: details.subscriptionRequired,
        category: details.category,
        castAndCrew: details.castAndCrew,
        customTrailerUrl: details.customTrailerUrl.trim(),
        trailerVideoId: trailerVideoId || undefined,
        removeTrailer: isEdit && removeTrailer && !trailerVideoId ? true : undefined,
        verticalPoster: posterFile || undefined,
        banner: bannerFile || undefined,
        thumbnail: thumbFile || undefined,
      });
      const { data } = isEdit ? await api.put(`/webseries/${id}`, fd) : await api.post("/webseries", fd);
      const saved = data.data as Series;
      queryClient.invalidateQueries({ queryKey: ["webseries", "list"] });
      if (saved?._id) queryClient.setQueryData(seriesDetailKey(saved._id), saved);
      if (isEdit) {
        toast.success(data.message || "Saved");
        resetFiles();
        if (saved) setDetails(fromSeries(saved));
      } else {
        toast.success(`${L.One} created. Now add a season and its episodes.`);
        navigate(`${L.base}/${saved._id}/edit`, { replace: true, state: { tab: "seasons" } });
        setTab("seasons");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ───────── states ───────── */

  if (isEdit && seriesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isEdit && seriesQuery.isError) {
    const status = (seriesQuery.error as AxiosError)?.response?.status;
    const notFound = status === 404 || status === 400;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
        <p className="font-medium">{notFound ? `This ${L.one} was not found` : "Could not load it"}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {notFound ? "It may have been deleted. Go back to the list." : errorMessage(seriesQuery.error)}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={L.base}>
              <ArrowLeft className="h-4 w-4" /> Back to {L.many}
            </Link>
          </Button>
          {!notFound && (
            <Button type="button" onClick={() => seriesQuery.refetch()}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const detailsForm = (
    <DetailsForm
      contentType={contentType}
      isEdit={isEdit}
      series={series}
      details={details}
      set={set}
      errors={errors}
      categories={categoriesQuery.data || []}
      categoriesLoading={categoriesQuery.isLoading}
      people={peopleQuery.data || []}
      peopleLoading={peopleQuery.isLoading}
      peopleError={peopleQuery.isError}
      posterFile={posterFile}
      setPosterFile={setPosterFile}
      bannerFile={bannerFile}
      setBannerFile={setBannerFile}
      thumbFile={thumbFile}
      setThumbFile={setThumbFile}
      trailerVideoId={trailerVideoId}
      setTrailerVideoId={setTrailerVideoId}
      setTrailerUploading={setTrailerUploading}
      removeTrailer={removeTrailer}
      setRemoveTrailer={setRemoveTrailer}
      saving={saving}
      trailerUploading={trailerUploading}
      onSubmit={submit}
      onCancel={() => navigate(L.base)}
    />
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to={L.base}>
          <ArrowLeft className="h-4 w-4" /> {L.Many}
        </Link>
      </Button>
      <PageHeader
        title={isEdit ? series?.title || `Edit ${L.one}` : `Add ${L.one}`}
        description={
          isEdit
            ? `Edit the details, and manage seasons and episodes.`
            : `Fill in the details and save. After that you can add seasons and episodes.`
        }
      />

      {isEdit && series ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="seasons">Seasons & episodes ({series.total_episodes ?? 0})</TabsTrigger>
          </TabsList>
          {/* forceMount keeps an in-progress trailer upload alive when switching tabs */}
          <TabsContent value="details" forceMount className="data-[state=inactive]:hidden">
            {detailsForm}
          </TabsContent>
          <TabsContent value="seasons" forceMount className="data-[state=inactive]:hidden">
            <SeasonsManager series={series} refreshing={seriesQuery.isFetching} onRefresh={() => seriesQuery.refetch()} />
          </TabsContent>
        </Tabs>
      ) : (
        detailsForm
      )}
    </div>
  );
}

/* ───────── Details form ───────── */

interface DetailsFormProps {
  contentType: SeriesContentType;
  isEdit: boolean;
  series?: Series;
  details: Details;
  set: <K extends keyof Details>(key: K, value: Details[K]) => void;
  errors: Record<string, string>;
  categories: Category[];
  categoriesLoading: boolean;
  people: PersonRef[];
  peopleLoading: boolean;
  peopleError: boolean;
  posterFile: File | null;
  setPosterFile: (f: File | null) => void;
  bannerFile: File | null;
  setBannerFile: (f: File | null) => void;
  thumbFile: File | null;
  setThumbFile: (f: File | null) => void;
  trailerVideoId: string | null;
  setTrailerVideoId: (id: string | null) => void;
  setTrailerUploading: (b: boolean) => void;
  removeTrailer: boolean;
  setRemoveTrailer: (b: boolean) => void;
  saving: boolean;
  trailerUploading: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

function DetailsForm(p: DetailsFormProps) {
  const { details, set, errors, series, isEdit } = p;
  const L = seriesLabels(p.contentType);

  // keep values that are not in our fixed lists (older data) selectable
  const langOptions = details.lang && !LANGUAGES.includes(details.lang) ? [details.lang, ...LANGUAGES] : LANGUAGES;
  const ageOptions = details.ageRating && !AGE_RATINGS.includes(details.ageRating) ? [details.ageRating, ...AGE_RATINGS] : AGE_RATINGS;
  const categoryMissing = details.category && !p.categoriesLoading && !p.categories.some((c) => c._id === details.category);

  const trailerCurrent = useMemo(
    () => (series?.trailer?.videoId ? { videoId: series.trailer.videoId, status: series.trailer.status, url: series.trailer.url } : null),
    [series?.trailer?.videoId, series?.trailer?.status, series?.trailer?.url]
  );

  return (
    <form onSubmit={p.onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={details.title} onChange={(e) => set("title", e.target.value)} placeholder={`Name of the ${L.one}`} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} value={details.description} onChange={(e) => set("description", e.target.value)} placeholder="What is it about?" />
          </div>
          <div className="space-y-1.5">
            <Label>Genres</Label>
            <TagInput value={details.genres} onChange={(v) => set("genres", v)} suggestions={GENRE_SUGGESTIONS} placeholder="Type a genre and press Enter" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select value={details.lang} onValueChange={(v) => set("lang", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose language" />
                </SelectTrigger>
                <SelectContent>
                  {langOptions.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Age rating</Label>
              <Select value={details.ageRating || NONE} onValueChange={(v) => set("ageRating", v === NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {ageOptions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imdb">IMDb rating</Label>
              <Input id="imdb" type="number" min={0} max={10} step={0.1} value={details.imdbRating} onChange={(e) => set("imdbRating", e.target.value)} placeholder="e.g. 7.5" />
              {errors.imdbRating && <p className="text-xs text-destructive">{errors.imdbRating}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="release">Release date</Label>
              <Input id="release" type="date" value={details.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5 sm:max-w-sm">
            <Label>Category</Label>
            <Select value={details.category || NONE} onValueChange={(v) => set("category", v === NONE ? "" : v)} disabled={p.categoriesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={p.categoriesLoading ? "Loading…" : "None"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {categoryMissing && <SelectItem value={details.category}>(Category from another type)</SelectItem>}
                {p.categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optional. Lists {p.contentType === "tvshow" ? "TV show" : "web series"} categories from the Categories page.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="published">Published</Label>
                <p className="text-xs text-muted-foreground">When on, people can see it in the app. Tip: add episodes first.</p>
              </div>
              <Switch id="published" checked={details.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="subscription">Subscription required</Label>
                <p className="text-xs text-muted-foreground">When on, only subscribers can watch the episodes.</p>
              </div>
              <Switch id="subscription" checked={details.subscriptionRequired} onCheckedChange={(v) => set("subscriptionRequired", v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cast & crew</CardTitle>
          <CardDescription>Pick people added on the Cast & Crew page.</CardDescription>
        </CardHeader>
        <CardContent>
          <PeoplePicker
            people={p.people}
            loading={p.peopleLoading}
            error={p.peopleError}
            value={details.castAndCrew}
            fallback={(series?.castAndCrew || []).filter((x) => typeof x !== "string") as PersonRef[]}
            onChange={(v) => set("castAndCrew", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <CardDescription>Use clear, good-quality images. JPG or PNG, up to 20 MB.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <ImagePicker
            label="Poster"
            hint="Portrait (2:3). Shown in rows of posters."
            aspect="portrait"
            value={series?.verticalPoster || undefined}
            file={p.posterFile}
            onChange={p.setPosterFile}
          />
          <div className="space-y-4">
            <ImagePicker
              label="Banner"
              hint="Landscape (16:9). Shown on the details screen and big rows."
              aspect="landscape"
              value={series?.horizontalBanner || undefined}
              file={p.bannerFile}
              onChange={p.setBannerFile}
            />
            <ImagePicker
              label="Card image (optional)"
              hint="Landscape (16:9). Small card image; if empty the poster is used."
              aspect="landscape"
              value={series?.thumbnail && series.thumbnail !== series.verticalPoster ? series.thumbnail : undefined}
              file={p.thumbFile}
              onChange={p.setThumbFile}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trailer</CardTitle>
          <CardDescription>Optional. Upload a trailer video or paste a link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VideoUploadField
            label="Trailer video"
            title={`${details.title || L.One} - Trailer`}
            current={p.removeTrailer ? null : trailerCurrent}
            newVideoId={p.trailerVideoId}
            onUploaded={(vid) => {
              p.setTrailerVideoId(vid);
              if (vid) p.setRemoveTrailer(false);
            }}
            onBusyChange={p.setTrailerUploading}
          />
          {isEdit && trailerCurrent && !p.trailerVideoId && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={p.removeTrailer} onCheckedChange={(v) => p.setRemoveTrailer(v === true)} />
              Remove the current trailer video when I save
            </label>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="trailer-url">Or a trailer link</Label>
            <Input id="trailer-url" value={details.customTrailerUrl} onChange={(e) => set("customTrailerUrl", e.target.value)} placeholder="https://…" />
            {errors.customTrailerUrl ? (
              <p className="text-xs text-destructive">{errors.customTrailerUrl}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Only if the trailer is hosted somewhere else. If filled, this link is played instead of the uploaded trailer.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        {p.trailerUploading && <span className="mr-auto text-xs text-muted-foreground">Wait for the trailer upload to finish before saving.</span>}
        <Button type="button" variant="outline" onClick={p.onCancel} disabled={p.saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={p.saving || p.trailerUploading}>
          {p.saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {p.saving ? "Saving…" : isEdit ? "Save changes" : `Create ${L.one}`}
        </Button>
      </div>
    </form>
  );
}

/* ───────── Cast & crew multi-select ───────── */

function PeoplePicker({
  people,
  loading,
  error,
  value,
  fallback,
  onChange,
}: {
  people: PersonRef[];
  loading: boolean;
  error: boolean;
  value: string[];
  fallback: PersonRef[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => {
    const m = new Map<string, PersonRef>();
    for (const x of fallback) m.set(x._id, x);
    for (const x of people) m.set(x._id, x);
    return m;
  }, [people, fallback]);

  const toggle = (pid: string) => onChange(value.includes(pid) ? value.filter((v) => v !== pid) : [...value, pid]);

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between sm:w-80" disabled={loading}>
            {loading ? "Loading people…" : value.length ? `${value.length} selected` : "Choose people"}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name…" />
            <CommandList>
              <CommandEmpty>{error ? "Could not load people." : "No one found. Add people on the Cast & Crew page."}</CommandEmpty>
              <CommandGroup>
                {people.map((person) => {
                  const selected = value.includes(person._id);
                  return (
                    <CommandItem key={person._id} className="gap-2" value={`${person.personName} ${person.role} ${person._id}`} onSelect={() => toggle(person._id)}>
                      <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{person.personName}</span>
                      {person.role && <span className="ml-auto text-xs text-muted-foreground">{person.role}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((pid) => {
            const person = byId.get(pid);
            return (
              <span key={pid} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-2 text-sm">
                {person?.profileImage?.url ? (
                  <img src={person.profileImage.url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {(person?.personName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <span>{person?.personName || (loading ? "Loading…" : "Removed person")}</span>
                {person?.role && <span className="text-xs text-muted-foreground">{person.role}</span>}
                <button type="button" onClick={() => toggle(pid)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No one selected.</p>
      )}
    </div>
  );
}
