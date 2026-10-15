import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { ArrowLeft, ChevronDown, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader } from "@/components/common/PageHeader";
import { ImagePicker } from "@/components/common/ImagePicker";
import { VideoUploadField } from "@/components/common/VideoUploadField";
import { TagInput } from "@/components/common/TagInput";
import { EmptyState } from "@/components/common/EmptyState";
import { PeopleEditor } from "@/components/movies/PeopleEditor";
import {
  AGE_RATINGS,
  AUDIO_FORMATS,
  buildFormData,
  CREW_ROLES,
  emptyFields,
  emptyPeople,
  Errors,
  FIELD_ORDER,
  fieldsFromMovie,
  GENRES,
  ImageFiles,
  LANGUAGES,
  MovieFields,
  MovieRecord,
  People,
  PeopleKey,
  peopleFromMovie,
  validate,
  Vendor,
  VIDEO_QUALITIES,
} from "@/components/movies/movieFormModel";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

// ───────── Small layout helpers ─────────
function Field({ id, label, required, hint, error, children, className }: { id?: string; label: string; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div id={id ? `field-${id}` : undefined} className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const errorBorder = (err?: string) => (err ? "border-destructive focus-visible:ring-destructive" : "");

// ───────── Page ─────────
export default function MovieForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const movieQuery = useQuery({
    queryKey: ["movie", id],
    queryFn: async () => (await api.get(`/movies/${id}`)).data.data as MovieRecord,
    enabled: isEdit,
    retry: (count, err) => {
      const status = (err as AxiosError)?.response?.status;
      return status !== 404 && status !== 400 && count < 1;
    },
  });
  const movie = movieQuery.data;

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "options"],
    queryFn: async () => ((await api.get("/vendors")).data.data || []) as Vendor[],
    retry: false,
    staleTime: 60_000,
  });
  // null → list not available, so the form leaves the movie's vendor untouched
  const vendors: Vendor[] | null = vendorsQuery.isSuccess ? vendorsQuery.data : null;

  const [fields, setFields] = useState<MovieFields>(emptyFields);
  const [people, setPeople] = useState<People>(emptyPeople);
  const [images, setImages] = useState<ImageFiles>({ verticalPoster: null, horizontalBanner: null, logo: null });
  const [movieVideoId, setMovieVideoId] = useState<string | null>(null);
  const [trailerVideoId, setTrailerVideoId] = useState<string | null>(null);
  const [removeTrailer, setRemoveTrailer] = useState(false);
  const [langOther, setLangOther] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [movieBusy, setMovieBusy] = useState(false);
  const [trailerBusy, setTrailerBusy] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const loadedId = useRef<string | null>(null);

  const uploading = movieBusy || trailerBusy;
  const onMovieBusy = useCallback((b: boolean) => setMovieBusy(b), []);
  const onTrailerBusy = useCallback((b: boolean) => setTrailerBusy(b), []);

  // Fill the form once when the movie arrives (later refetches must not wipe edits)
  useEffect(() => {
    if (!movie || loadedId.current === movie._id) return;
    loadedId.current = movie._id;
    const f = fieldsFromMovie(movie);
    setFields(f);
    setPeople(peopleFromMovie(movie));
    setLangOther(!!f.lang && !LANGUAGES.includes(f.lang));
    if (movie.seoTitle || movie.seoDescription || movie.seoKeywords?.length) setSeoOpen(true);
  }, [movie]);

  // Warn before closing the tab while a video is still uploading
  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const clearError = (key: string) => {
    if (!errors[key]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const set = <K extends keyof MovieFields>(key: K, value: MovieFields[K]) => {
    setFields((f) => ({ ...f, [key]: value }));
    clearError(key === "skipIntroStart" || key === "skipIntroEnd" ? "skipIntro" : (key as string));
  };
  const setRole = (key: PeopleKey, list: People[PeopleKey]) => {
    setPeople((p) => ({ ...p, [key]: list }));
    clearError(`people_${key}`);
  };

  const leave = () => {
    if (uploading && !window.confirm("A video is still uploading. Leave this page and cancel the upload?")) return;
    navigate("/movies");
  };

  const save = useMutation({
    mutationFn: async (publishStatus: boolean) => {
      const fd = buildFormData({
        fields: { ...fields, publishStatus, lang: fields.lang.trim() || (langOther ? "Other" : "") },
        people,
        images,
        vendors,
        movieVideoId,
        trailerVideoId,
        removeTrailer,
        original: movie,
      });
      setSaveProgress(0);
      const config = {
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (e.total) setSaveProgress(Math.round((e.loaded / e.total) * 100));
        },
      };
      const res = isEdit ? await api.put(`/movies/${id}`, fd, config) : await api.post("/movies", fd, config);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res?.message || (isEdit ? "Movie updated" : "Movie created"));
      qc.invalidateQueries({ queryKey: ["movies"] });
      if (isEdit) qc.removeQueries({ queryKey: ["movie", id] });
      navigate("/movies");
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => setSaveProgress(null),
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploading || save.isPending) return;
    // Which button was pressed? (Enter key = first submit button = "Save as draft" on create)
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publishStatus = isEdit ? fields.publishStatus : submitter?.dataset.intent === "publish";

    const lang = fields.lang.trim() || (langOther ? "Other" : "");
    const found = validate({ ...fields, lang }, people);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      toast.error("Please fix the highlighted fields.");
      const el = document.getElementById(first.startsWith("people_") ? first : `field-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    save.mutate(publishStatus);
  };

  // ───────── Loading / error states (edit mode) ─────────
  if (isEdit && movieQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isEdit && movieQuery.isError) {
    const status = (movieQuery.error as AxiosError)?.response?.status;
    const notFound = status === 404 || status === 400;
    return (
      <EmptyState
        icon={<Film className="h-8 w-8" />}
        title={notFound ? "Movie not found" : "Could not load this movie"}
        description={notFound ? "It may have been deleted. Go back to the movie list." : errorMessage(movieQuery.error)}
        action={
          <div className="flex gap-2">
            {!notFound && (
              <Button type="button" variant="outline" onClick={() => movieQuery.refetch()}>
                Retry
              </Button>
            )}
            <Button asChild variant={notFound ? "default" : "ghost"}>
              <Link to="/movies">Back to movies</Link>
            </Button>
          </div>
        }
      />
    );
  }

  const hasTrailer = !!movie?.trailer?.videoId;
  const saving = save.isPending;
  const disableSave = saving || uploading;
  const savingLabel = saveProgress !== null && saveProgress < 100 ? `Saving… ${saveProgress}%` : "Saving…";

  return (
    <form onSubmit={onSubmit} noValidate>
      <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={leave}>
        <ArrowLeft className="mr-1 h-4 w-4" /> All movies
      </Button>
      <PageHeader
        title={isEdit ? `Edit: ${movie?.movieTitle || "movie"}` : "Add movie"}
        description="Fields marked * are required."
      />

      <div className="space-y-6">
        {/* ───── Basic info ───── */}
        <Section title="Basic info">
          <Field id="movieTitle" label="Movie title" required error={errors.movieTitle}>
            <Input id="movieTitle" value={fields.movieTitle} onChange={(e) => set("movieTitle", e.target.value)} className={errorBorder(errors.movieTitle)} />
          </Field>
          <Field id="tagline" label="Tagline" hint="One short line shown under the title, e.g. “Every family has a secret.”">
            <Input id="tagline" value={fields.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field id="description" label="Description" required error={errors.description} hint="2–3 sentences shown on the movie page.">
            <Textarea id="description" rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} className={errorBorder(errors.description)} />
          </Field>
          <Field id="fullStoryline" label="Full storyline">
            <Textarea id="fullStoryline" rows={5} value={fields.fullStoryline} onChange={(e) => set("fullStoryline", e.target.value)} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="genres" label="Genres" required error={errors.genres} hint="Type and press Enter, or tap a suggestion.">
              <TagInput value={fields.genres} onChange={(v) => set("genres", v)} suggestions={GENRES} placeholder="Add a genre" />
            </Field>
            <Field id="tags" label="Tags" hint="Extra search words, e.g. “village”, “based on true story”.">
              <TagInput value={fields.tags} onChange={(v) => set("tags", v)} placeholder="Add a tag" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="lang" label="Language" required error={errors.lang}>
              <Select
                value={langOther ? "Other" : fields.lang}
                onValueChange={(v) => {
                  if (v === "Other") {
                    setLangOther(true);
                    set("lang", "");
                  } else {
                    setLangOther(false);
                    set("lang", v);
                  }
                }}
              >
                <SelectTrigger id="lang" className={errorBorder(errors.lang)}>
                  <SelectValue placeholder="Choose language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {langOther && <Input className="mt-2" value={fields.lang} onChange={(e) => set("lang", e.target.value)} placeholder="Type the language (optional)" />}
            </Field>
            <Field id="ageRating" label="Age rating" required error={errors.ageRating}>
              <Select value={fields.ageRating} onValueChange={(v) => set("ageRating", v)}>
                <SelectTrigger id="ageRating" className={errorBorder(errors.ageRating)}>
                  <SelectValue placeholder="Choose rating" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="duration" label="Duration (minutes)" required error={errors.duration}>
              <Input id="duration" type="number" min={1} inputMode="numeric" value={fields.duration} onChange={(e) => set("duration", e.target.value)} className={errorBorder(errors.duration)} />
            </Field>
            <Field id="releaseYear" label="Release year" required error={errors.releaseYear}>
              <Input id="releaseYear" type="number" inputMode="numeric" value={fields.releaseYear} onChange={(e) => set("releaseYear", e.target.value)} className={errorBorder(errors.releaseYear)} />
            </Field>
            <Field id="releaseDate" label="Release date" hint="Optional.">
              <Input id="releaseDate" type="date" value={fields.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} />
            </Field>
            <Field id="imdbRating" label="IMDb rating" error={errors.imdbRating} hint="0 to 10. Leave empty if unknown.">
              <Input id="imdbRating" type="number" step="0.1" min={0} max={10} value={fields.imdbRating} onChange={(e) => set("imdbRating", e.target.value)} className={errorBorder(errors.imdbRating)} />
            </Field>
          </div>
        </Section>

        {/* ───── Images ───── */}
        <Section title="Images" description="New images replace the old ones when you save.">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
            <ImagePicker
              label="Poster (portrait)"
              hint="2:3, e.g. 600×900"
              aspect="portrait"
              value={movie?.verticalPosterUrl}
              file={images.verticalPoster}
              onChange={(f) => setImages((i) => ({ ...i, verticalPoster: f }))}
            />
            <div className="space-y-4">
              <ImagePicker
                label="Banner (landscape)"
                hint="16:9, e.g. 1920×1080"
                aspect="landscape"
                value={movie?.horizontalBannerUrl}
                file={images.horizontalBanner}
                onChange={(f) => setImages((i) => ({ ...i, horizontalBanner: f }))}
              />
              <ImagePicker
                label="Title logo"
                hint="Wide transparent PNG works best."
                aspect="wide"
                value={movie?.logoUrl}
                file={images.logo}
                onChange={(f) => setImages((i) => ({ ...i, logo: f }))}
              />
            </div>
          </div>
        </Section>

        {/* ───── Video ───── */}
        <Section title="Video" description="Videos upload straight to Bunny. Keep this page open until the upload finishes, then save.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <VideoUploadField
                label="Main movie"
                title={fields.movieTitle.trim() || "Movie"}
                current={movie?.movieFile}
                newVideoId={movieVideoId}
                onUploaded={setMovieVideoId}
                onBusyChange={onMovieBusy}
              />
              <Field id="customVideoUrl" label="Or paste a video link" error={errors.customVideoUrl} hint="Only use this for a video hosted somewhere else. If filled, the app plays this link instead of the uploaded video.">
                <Input id="customVideoUrl" type="url" placeholder="https://…" value={fields.customVideoUrl} onChange={(e) => set("customVideoUrl", e.target.value)} className={errorBorder(errors.customVideoUrl)} />
              </Field>
            </div>
            <div className="space-y-3">
              <VideoUploadField
                label="Trailer"
                title={`${fields.movieTitle.trim() || "Movie"} - Trailer`}
                current={removeTrailer ? null : movie?.trailer}
                newVideoId={trailerVideoId}
                onUploaded={(vid) => {
                  setTrailerVideoId(vid);
                  if (vid) setRemoveTrailer(false);
                }}
                onBusyChange={onTrailerBusy}
              />
              {isEdit && hasTrailer && !trailerVideoId && (
                <ToggleRow label="Remove trailer" hint="Deletes the current trailer when you save." checked={removeTrailer} onChange={setRemoveTrailer} />
              )}
              <Field id="customTrailerUrl" label="Or paste a trailer link" error={errors.customTrailerUrl} hint="Only use this for a trailer hosted somewhere else. If filled, the app plays this link instead of the uploaded trailer.">
                <Input id="customTrailerUrl" type="url" placeholder="https://…" value={fields.customTrailerUrl} onChange={(e) => set("customTrailerUrl", e.target.value)} className={errorBorder(errors.customTrailerUrl)} />
              </Field>
            </div>
          </div>

          <div id="field-skipIntro" className="space-y-1.5">
            <div className="text-sm font-medium">Skip intro button</div>
            <div className="grid max-w-md grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="skipIntroStart" className="text-xs text-muted-foreground">
                  Intro starts at (seconds)
                </Label>
                <Input id="skipIntroStart" type="number" min={0} value={fields.skipIntroStart} onChange={(e) => set("skipIntroStart", e.target.value)} className={errorBorder(errors.skipIntro)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="skipIntroEnd" className="text-xs text-muted-foreground">
                  Intro ends at (seconds)
                </Label>
                <Input id="skipIntroEnd" type="number" min={0} value={fields.skipIntroEnd} onChange={(e) => set("skipIntroEnd", e.target.value)} className={errorBorder(errors.skipIntro)} />
              </div>
            </div>
            {errors.skipIntro ? (
              <p className="text-xs text-destructive">{errors.skipIntro}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Leave both at 0 for no skip button. Example: 30 and 95 shows “Skip intro” from 0:30 to 1:35.</p>
            )}
          </div>
        </Section>

        {/* ───── Cast & crew ───── */}
        <Section title="Cast & crew" description="Add people by hand or pick them from your Cast & Crew directory. Photos are optional.">
          <PeopleEditor
            id="people_castMembers"
            title="Cast"
            roleLabel="Actor"
            withCharacter
            people={people.castMembers}
            onChange={(list) => setRole("castMembers", list)}
            error={errors.people_castMembers}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {CREW_ROLES.map((r) => (
              <PeopleEditor
                key={r.key}
                id={`people_${r.key}`}
                title={r.label}
                roleLabel={r.label}
                people={people[r.key]}
                onChange={(list) => setRole(r.key, list)}
                error={errors[`people_${r.key}`]}
              />
            ))}
          </div>
        </Section>

        {/* ───── Details ───── */}
        <Section title="Details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Production studio">
              <TagInput value={fields.productionStudio} onChange={(v) => set("productionStudio", v)} placeholder="Add a studio" />
            </Field>
            <Field label="Country of origin">
              <TagInput value={fields.countryOfOrigin} onChange={(v) => set("countryOfOrigin", v)} placeholder="Add a country" suggestions={["India"]} />
            </Field>
            <Field id="budget" label="Budget" hint="Free text, e.g. “₹5 crore”.">
              <Input id="budget" value={fields.budget} onChange={(e) => set("budget", e.target.value)} />
            </Field>
            <Field id="awardsAndNominations" label="Awards & nominations">
              <Input id="awardsAndNominations" value={fields.awardsAndNominations} onChange={(e) => set("awardsAndNominations", e.target.value)} />
            </Field>
            <Field label="Video quality">
              <Select value={fields.videoQuality} onValueChange={(v) => set("videoQuality", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_QUALITIES.map((q) => (
                    <SelectItem key={q} value={q}>
                      {q}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Audio format">
              <Select value={fields.audioFormat} onValueChange={(v) => set("audioFormat", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIO_FORMATS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Audio languages">
              <TagInput value={fields.audioTracks} onChange={(v) => set("audioTracks", v)} placeholder="Add an audio language" suggestions={["Hindi", "English"]} />
            </Field>
            <Field label="Subtitles">
              <TagInput value={fields.subtitles} onChange={(v) => set("subtitles", v)} placeholder="Add a subtitle language" suggestions={["English", "Hindi"]} />
            </Field>
          </div>
          {vendors && vendors.length > 0 && (
            <Field label="Content vendor" hint="Who supplied this movie (used for vendor reports).">
              <Select value={fields.vendorId || "internal"} onValueChange={(v) => set("vendorId", v === "internal" ? "" : v)}>
                <SelectTrigger className="md:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (our own content)</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.name}
                      {v.status === "inactive" ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </Section>

        {/* ───── Publishing ───── */}
        <Section title="Publishing">
          {isEdit ? (
            <ToggleRow
              label="Published"
              hint={fields.publishStatus ? "Visible in the app." : "Draft — hidden from the app."}
              checked={fields.publishStatus}
              onChange={(v) => set("publishStatus", v)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Use “Save as draft” or “Publish” at the bottom of the page.</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Paid / subscribers only" hint="Only users with an active plan can watch." checked={fields.subscriptionRequired} onChange={(v) => set("subscriptionRequired", v)} />
            <ToggleRow label="Show ads" checked={fields.enableAds} onChange={(v) => set("enableAds", v)} />
            <ToggleRow label="Allow downloads" hint="Needs “MP4 fallback” turned on in your Bunny Stream library." checked={fields.allowDownloads} onChange={(v) => set("allowDownloads", v)} />
            <ToggleRow label="Featured movie" checked={fields.featuredMovie} onChange={(v) => set("featuredMovie", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="publishDate" label="Publish date" hint="Optional. The movie appears in the app from this date/time (leave empty = right away).">
              <Input id="publishDate" type="datetime-local" value={fields.publishDate} onChange={(e) => set("publishDate", e.target.value)} />
            </Field>
            <Field id="expiryDate" label="Expiry date" error={errors.expiryDate} hint="Optional. The movie is hidden from the app after this date/time.">
              <Input id="expiryDate" type="datetime-local" value={fields.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={errorBorder(errors.expiryDate)} />
            </Field>
          </div>
        </Section>

        {/* ───── SEO ───── */}
        <Card>
          <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between p-6 text-left">
                <span>
                  <span className="block text-lg font-semibold">SEO</span>
                  <span className="block text-sm text-muted-foreground">Optional. How the movie appears in Google search.</span>
                </span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", seoOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <Field id="seoTitle" label="SEO title">
                  <Input id="seoTitle" value={fields.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                </Field>
                <Field id="seoDescription" label="SEO description">
                  <Textarea id="seoDescription" rows={3} value={fields.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
                </Field>
                <Field label="SEO keywords">
                  <TagInput value={fields.seoKeywords} onChange={(v) => set("seoKeywords", v)} placeholder="Add a keyword" />
                </Field>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>

      {/* ───── Sticky save bar ───── */}
      <div className="sticky bottom-0 z-10 -mx-3 mt-6 border-t bg-background/95 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {uploading ? "Please wait — a video is still uploading." : saving ? "Saving, please keep this page open…" : isEdit ? "Changes are saved only when you press Save." : ""}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={leave} disabled={saving}>
              Cancel
            </Button>
            {isEdit ? (
              <Button type="submit" data-intent="save" disabled={disableSave}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {saving ? savingLabel : "Save changes"}
              </Button>
            ) : (
              <>
                <Button type="submit" variant="outline" data-intent="draft" disabled={disableSave}>
                  {saving && save.variables === false && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {saving && save.variables === false ? savingLabel : "Save as draft"}
                </Button>
                <Button type="submit" data-intent="publish" disabled={disableSave}>
                  {saving && save.variables === true && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {saving && save.variables === true ? savingLabel : "Publish"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
