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
import { beginSave, endSave } from "@/lib/bunnyUpload";
import { useLeaveGuard } from "@/lib/leaveGuard";
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
  // when this page opened: cached data older than this is not used to fill the form
  const [openedAt] = useState(() => Date.now());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const movieQuery = useQuery({
    queryKey: ["movie", id],
    queryFn: async () => (await api.get(`/movies/${id}`)).data.data as MovieRecord,
    enabled: isEdit,
    // always load fresh data (e.g. publish status changed from the list)
    refetchOnMount: "always",
    retry: (count, err) => {
      const status = (err as AxiosError)?.response?.status;
      return status !== 404 && status !== 400 && count < 1;
    },
  });
  const movie = movieQuery.data;
  // data fetched (or saved) since this page opened — not an older cached copy
  const freshMovie = movie && movieQuery.dataUpdatedAt >= openedAt ? movie : undefined;

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
  const [removeLogo, setRemoveLogo] = useState(false);
  const [langOther, setLangOther] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [movieBusy, setMovieBusy] = useState(false);
  const [trailerBusy, setTrailerBusy] = useState(false);
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
  const [seoOpen, setSeoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [useLink, setUseLink] = useState(false);
  const loadedId = useRef<string | null>(null);
  // which submit button was pressed (SubmitEvent.submitter is missing on older Safari)
  const intent = useRef<"draft" | "publish">("draft");

  const uploading = movieBusy || trailerBusy;
  const onMovieBusy = useCallback((b: boolean) => setMovieBusy(b), []);
  const onTrailerBusy = useCallback((b: boolean) => setTrailerBusy(b), []);

  // Fill the form once when fresh movie data arrives (later refetches must not wipe edits)
  useEffect(() => {
    if (!freshMovie || loadedId.current === freshMovie._id) return;
    loadedId.current = freshMovie._id;
    const f = fieldsFromMovie(freshMovie);
    setFields(f);
    setPeople(peopleFromMovie(freshMovie));
    setLangOther(!!f.lang && !LANGUAGES.includes(f.lang));
    if (freshMovie.seoTitle || freshMovie.seoDescription || freshMovie.seoKeywords?.length) setSeoOpen(true);
    if (f.customVideoUrl) setUseLink(true);
  }, [freshMovie]);

  // a video was uploaded to Bunny but the movie is not saved yet
  const unsavedVideo = !!movieVideoId || !!trailerVideoId;

  const [savingNow, setSavingNow] = useState(false);
  // Warn before leaving (links, Back, closing the tab) while a video is uploading, saving, or uploaded but not saved
  const leaveReason = uploading
    ? "A video is still uploading. Leave this page and cancel the upload?"
    : savingNow
    ? "The movie is still saving. Leave this page anyway?"
    : unsavedVideo
    ? "You uploaded a video but haven't saved the movie. Leave without saving?"
    : null;
  useLeaveGuard(leaveReason);

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

  // Picking the video fills the title (from the file name) and the length automatically
  const onMovieFile = (file: File): string => {
    let title = fields.movieTitle.trim();
    if (!title) {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
      if (name) {
        title = name.replace(/\b\w/g, (c) => c.toUpperCase());
        set("movieTitle", title);
      }
    }
    if (!fields.duration.trim()) {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration) && v.duration > 0) setFields((f) => (f.duration.trim() ? f : { ...f, duration: String(Math.max(1, Math.round(v.duration / 60))) }));
        URL.revokeObjectURL(url);
      };
      v.onerror = () => URL.revokeObjectURL(url);
      v.src = url;
    }
    return title;
  };

  const toggleGenre = (g: string) => set("genres", fields.genres.includes(g) ? fields.genres.filter((x) => x !== g) : [...fields.genres, g]);

  const leave = () => {
    if (leaveReason && !window.confirm(leaveReason)) return;
    navigate("/movies");
  };

  const save = useMutation({
    mutationFn: async (publishStatus: boolean) => {
      const fromPath = window.location.pathname;
      const fd = buildFormData({
        fields: { ...fields, publishStatus, lang: fields.lang.trim() || (langOther ? "Other" : "") },
        people,
        images,
        vendors,
        movieVideoId,
        trailerVideoId,
        removeTrailer,
        removeLogo,
        original: movie,
      });
      setSaveProgress(0);
      const config = {
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (e.total) setSaveProgress(Math.round((e.loaded / e.total) * 100));
        },
      };
      const sent = [movieVideoId, trailerVideoId];
      const token = beginSave();
      let ok = false;
      try {
        const res = isEdit ? await api.put(`/movies/${id}`, fd, config) : await api.post("/movies", fd, config);
        ok = true;
        return { data: res.data, fromPath };
      } finally {
        endSave(token, ok, sent);
      }
    },
    onMutate: () => setSavingNow(true),
    onSuccess: ({ data: res, fromPath }) => {
      toast.success(res?.message || (isEdit ? "Movie updated" : "Movie created"));
      qc.invalidateQueries({ queryKey: ["movies"] });
      if (isEdit) qc.removeQueries({ queryKey: ["movie", id] });
      if (!alive.current) return;
      // the videos are saved now → nothing to warn about when leaving
      setMovieVideoId(null);
      setTrailerVideoId(null);
      setSavingNow(false);
      // only go back to the list if the admin is still on this form
      if (window.location.pathname === fromPath) navigate("/movies");
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      if (!alive.current) return;
      setSaveProgress(null);
      setSavingNow(false);
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uploading || save.isPending) return;
    // Which button was pressed? Each button records it on click (Enter key clicks the first one = "Save as draft")
    const publishStatus = isEdit ? fields.publishStatus : intent.current === "publish";
    intent.current = "draft";

    const lang = fields.lang.trim() || (langOther ? "Other" : "");
    const found = validate({ ...fields, lang }, people);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      toast.error("Please fix the highlighted fields.");
      const basic = ["movieTitle", "description", "genres", "lang", "ageRating", "duration", "releaseYear", "customVideoUrl"];
      if (!basic.includes(first)) setMoreOpen(true);
      if (first === "customVideoUrl") setUseLink(true);
      window.setTimeout(() => {
        const el = document.getElementById(first.startsWith("people_") ? first : `field-${first}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    save.mutate(publishStatus);
  };

  // ───────── Loading / error states (edit mode) ─────────
  // edit: wait for fresh data (an older cached copy is not used to fill the form)
  if (isEdit && !movieQuery.isError && (movieQuery.isLoading || !freshMovie)) {
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
        description="Only the title is required. Upload the video first — you can fill the rest while it uploads."
      />

      <div className="space-y-6">
        {/* ───── 1. Video ───── */}
        <Section title="1 · Movie video" description="Starts uploading straight away. Keep this page open until it finishes.">
          <VideoUploadField
            label="Main movie"
            title={fields.movieTitle.trim() || "Movie"}
            current={movie?.movieFile}
            newVideoId={movieVideoId}
            onUploaded={(vid) => {
              setMovieVideoId(vid);
              // the new upload should play → an old pasted link would play instead, so it is cleared
              if (vid) setFields((f) => (f.customVideoUrl ? { ...f, customVideoUrl: "" } : f));
            }}
            onBusyChange={onMovieBusy}
            onFilePicked={onMovieFile}
          />
          {useLink ? (
            <Field id="customVideoUrl" label="Video link" error={errors.customVideoUrl} hint="For a video hosted somewhere else. If filled, this link plays instead of the uploaded video.">
              <Input id="customVideoUrl" type="url" placeholder="https://…" value={fields.customVideoUrl} onChange={(e) => set("customVideoUrl", e.target.value)} className={errorBorder(errors.customVideoUrl)} />
            </Field>
          ) : (
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-2" onClick={() => setUseLink(true)}>
              Video is hosted somewhere else? Paste a link instead
            </button>
          )}
        </Section>

        {/* ───── 2. Basic details ───── */}
        <Section title="2 · Details">
          <Field id="movieTitle" label="Movie title" required error={errors.movieTitle}>
            <Input id="movieTitle" value={fields.movieTitle} onChange={(e) => set("movieTitle", e.target.value)} className={errorBorder(errors.movieTitle)} placeholder="e.g. Udd Ja Re" />
          </Field>
          <Field id="description" label="Short description" hint="2–3 lines shown on the movie page. Optional.">
            <Textarea id="description" rows={3} value={fields.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <Field id="genres" label="Genres" hint="Tap to choose. Type below for any other genre.">
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const on = fields.genres.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <TagInput value={fields.genres.filter((g) => !GENRES.includes(g))} onChange={(v) => set("genres", [...fields.genres.filter((g) => GENRES.includes(g)), ...v])} placeholder="Other genre + Enter" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="lang" label="Language">
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
                <SelectTrigger id="lang">
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
              {langOther && <Input className="mt-2" value={fields.lang} onChange={(e) => set("lang", e.target.value)} placeholder="Type the language" />}
            </Field>
            <Field id="ageRating" label="Age rating">
              <Select value={fields.ageRating} onValueChange={(v) => set("ageRating", v)}>
                <SelectTrigger id="ageRating">
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
            <Field id="duration" label="Length (minutes)" error={errors.duration} hint="Filled from the video.">
              <Input id="duration" type="number" min={1} inputMode="numeric" value={fields.duration} onChange={(e) => set("duration", e.target.value)} className={errorBorder(errors.duration)} placeholder="auto" />
            </Field>
            <Field id="releaseYear" label="Release year" error={errors.releaseYear}>
              <Input id="releaseYear" type="number" inputMode="numeric" value={fields.releaseYear} onChange={(e) => set("releaseYear", e.target.value)} className={errorBorder(errors.releaseYear)} />
            </Field>
          </div>
        </Section>

        {/* ───── 3. Pictures ───── */}
        <Section title="3 · Pictures" description="Poster for the rows, banner for the top of the movie page. New pictures replace the old ones when you save.">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
            <ImagePicker
              label="Poster (portrait)"
              hint="2:3, e.g. 600×900"
              aspect="portrait"
              value={movie?.verticalPosterUrl}
              file={images.verticalPoster}
              onChange={(f) => setImages((i) => ({ ...i, verticalPoster: f }))}
            />
            <ImagePicker
              label="Banner (landscape)"
              hint="16:9, e.g. 1920×1080"
              aspect="landscape"
              value={movie?.horizontalBannerUrl}
              file={images.horizontalBanner}
              onChange={(f) => setImages((i) => ({ ...i, horizontalBanner: f }))}
            />
          </div>
        </Section>

        {isEdit && (
          <Section title="Status">
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleRow
                label="Published"
                hint={fields.publishStatus ? "Visible in the app and website." : "Draft — hidden from the app and website."}
                checked={fields.publishStatus}
                onChange={(v) => set("publishStatus", v)}
              />
              <ToggleRow label="Paid / subscribers only" hint="Off = free for everyone." checked={fields.subscriptionRequired} onChange={(v) => set("subscriptionRequired", v)} />
            </div>
          </Section>
        )}

        {/* ───── More (optional) ───── */}
        <Card>
          <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between p-6 text-left">
                <span>
                  <span className="block text-lg font-semibold">More options (optional)</span>
                  <span className="block text-sm text-muted-foreground">Trailer, title logo, cast & crew, skip intro, ads, downloads, schedule, SEO…</span>
                </span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", moreOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            {/* forceMount: keeps the trailer upload (and typed values) alive while collapsed */}
            <CollapsibleContent forceMount className="data-[state=closed]:hidden">
              <CardContent className="space-y-8">
                {/* trailer + logo */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <VideoUploadField
                      label="Trailer"
                      title={`${fields.movieTitle.trim() || "Movie"} - Trailer`}
                      current={removeTrailer ? null : movie?.trailer}
                      newVideoId={trailerVideoId}
                      onUploaded={(vid) => {
                        setTrailerVideoId(vid);
                        if (vid) {
                          setRemoveTrailer(false);
                          // the new trailer should play → an old trailer link would play instead, so it is cleared
                          setFields((f) => (f.customTrailerUrl ? { ...f, customTrailerUrl: "" } : f));
                        }
                      }}
                      onBusyChange={onTrailerBusy}
                    />
                    {isEdit && hasTrailer && !trailerVideoId && (
                      <ToggleRow label="Remove trailer" hint="Deletes the current trailer when you save." checked={removeTrailer} onChange={setRemoveTrailer} />
                    )}
                    <Field id="customTrailerUrl" label="Or trailer link" error={errors.customTrailerUrl} hint="If filled, this link plays instead of the uploaded video.">
                      <Input id="customTrailerUrl" type="url" placeholder="https://…" value={fields.customTrailerUrl} onChange={(e) => set("customTrailerUrl", e.target.value)} className={errorBorder(errors.customTrailerUrl)} />
                    </Field>
                  </div>
                  <ImagePicker
                    label="Title logo"
                    hint="Wide transparent PNG works best."
                    aspect="wide"
                    value={movie?.logoUrl}
                    file={images.logo}
                    onChange={(f) => setImages((i) => ({ ...i, logo: f }))}
                    removed={removeLogo}
                    onRemoveChange={setRemoveLogo}
                  />
                </div>

                {/* more text */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field id="tagline" label="Tagline" hint="One short line, e.g. “Every family has a secret.”">
                    <Input id="tagline" value={fields.tagline} onChange={(e) => set("tagline", e.target.value)} />
                  </Field>
                  <Field id="tags" label="Search words" hint="e.g. “village”, “true story”.">
                    <TagInput value={fields.tags} onChange={(v) => set("tags", v)} placeholder="Add a word" />
                  </Field>
                  <Field id="imdbRating" label="IMDb rating" error={errors.imdbRating} hint="0 to 10.">
                    <Input id="imdbRating" type="number" step="0.1" min={0} max={10} value={fields.imdbRating} onChange={(e) => set("imdbRating", e.target.value)} className={errorBorder(errors.imdbRating)} />
                  </Field>
                  <Field id="releaseDate" label="Release date">
                    <Input id="releaseDate" type="date" value={fields.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} />
                  </Field>
                </div>
                <Field id="fullStoryline" label="Full storyline">
                  <Textarea id="fullStoryline" rows={4} value={fields.fullStoryline} onChange={(e) => set("fullStoryline", e.target.value)} />
                </Field>

                {/* skip intro */}
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
                    <p className="text-xs text-muted-foreground">Leave both at 0 for no button. Example: 30 and 95 → “Skip intro” from 0:30 to 1:35.</p>
                  )}
                </div>

                {/* cast & crew */}
                <div className="space-y-4">
                  <div className="text-base font-semibold">Cast &amp; crew</div>
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
                </div>

                {/* app options */}
                <div className="space-y-3">
                  <div className="text-base font-semibold">App options</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {!isEdit && (
                      <ToggleRow label="Paid / subscribers only" hint="Off = free for everyone." checked={fields.subscriptionRequired} onChange={(v) => set("subscriptionRequired", v)} />
                    )}
                    <ToggleRow label="Show ads" checked={fields.enableAds} onChange={(v) => set("enableAds", v)} />
                    <ToggleRow label="Allow downloads" hint="Needs “MP4 fallback” on in Bunny Stream." checked={fields.allowDownloads} onChange={(v) => set("allowDownloads", v)} />
                    <ToggleRow label="Featured movie" checked={fields.featuredMovie} onChange={(v) => set("featuredMovie", v)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="publishDate" label="Show from (date/time)" hint="Empty = right away.">
                      <Input id="publishDate" type="datetime-local" value={fields.publishDate} onChange={(e) => set("publishDate", e.target.value)} />
                    </Field>
                    <Field id="expiryDate" label="Hide after (date/time)" error={errors.expiryDate} hint="Empty = never.">
                      <Input id="expiryDate" type="datetime-local" value={fields.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={errorBorder(errors.expiryDate)} />
                    </Field>
                  </div>
                </div>

                {/* production details */}
                <div className="space-y-3">
                  <div className="text-base font-semibold">Production details</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Production studio">
                      <TagInput value={fields.productionStudio} onChange={(v) => set("productionStudio", v)} placeholder="Add a studio" />
                    </Field>
                    <Field label="Country of origin">
                      <TagInput value={fields.countryOfOrigin} onChange={(v) => set("countryOfOrigin", v)} placeholder="Add a country" suggestions={["India"]} />
                    </Field>
                    <Field id="budget" label="Budget">
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
                    <Field label="Content vendor" hint="Who supplied this movie (for vendor reports).">
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
                </div>

                {/* SEO */}
                <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex items-center gap-2 text-base font-semibold">
                      Google search (SEO) <ChevronDown className={cn("h-4 w-4 transition-transform", seoOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent forceMount className="space-y-4 pt-3 data-[state=closed]:hidden">
                    <Field id="seoTitle" label="SEO title">
                      <Input id="seoTitle" value={fields.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
                    </Field>
                    <Field id="seoDescription" label="SEO description">
                      <Textarea id="seoDescription" rows={3} value={fields.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
                    </Field>
                    <Field label="SEO keywords">
                      <TagInput value={fields.seoKeywords} onChange={(v) => set("seoKeywords", v)} placeholder="Add a keyword" />
                    </Field>
                  </CollapsibleContent>
                </Collapsible>
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
                <Button type="submit" variant="outline" data-intent="draft" disabled={disableSave} onClick={() => (intent.current = "draft")}>
                  {saving && save.variables === false && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {saving && save.variables === false ? savingLabel : "Save as draft"}
                </Button>
                <Button type="submit" data-intent="publish" disabled={disableSave} onClick={() => (intent.current = "publish")}>
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
