import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage, realCustomLink, toFormData } from "@/lib/api";
import { beginSave, endSave } from "@/lib/bunnyUpload";
import { useLeaveGuard } from "@/lib/leaveGuard";
import { ImagePicker } from "@/components/common/ImagePicker";
import { VideoUploadField } from "@/components/common/VideoUploadField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Episode, Season, Series, isValidUrl, rawImage, toDateInput } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  seriesTitle: string;
  season: Season | null;
  episode: Episode | null; // null = add new
  onSaved: (series: Series) => void;
}

interface EpisodeForm {
  episodeNumber: string;
  title: string;
  description: string;
  releaseDate: string;
  isPublished: boolean;
  skipIntroStart: string;
  skipIntroEnd: string;
  customVideoUrl: string;
}

const nextEpisodeNumber = (season: Season | null) => Math.max(0, ...(season?.episodes || []).map((e) => e.episodeNumber || 0)) + 1;

const blank = (season: Season | null): EpisodeForm => ({
  episodeNumber: String(nextEpisodeNumber(season)),
  title: "",
  description: "",
  releaseDate: "",
  isPublished: true,
  skipIntroStart: "",
  skipIntroEnd: "",
  customVideoUrl: "",
});

const fromEpisode = (e: Episode): EpisodeForm => ({
  episodeNumber: String(e.episodeNumber || ""),
  title: e.title || "",
  description: e.description || "",
  releaseDate: toDateInput(e.releaseDate),
  isPublished: e.isPublished !== false,
  skipIntroStart: e.skipIntro?.start ? String(e.skipIntro.start) : "",
  skipIntroEnd: e.skipIntro?.end ? String(e.skipIntro.end) : "",
  customVideoUrl: realCustomLink(e.customVideoUrl, e.videoFile),
});

export function EpisodeDialog({ open, onOpenChange, seriesId, seriesTitle, season, episode, onSaved }: Props) {
  const [form, setForm] = useState<EpisodeForm>(() => blank(season));
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [removeThumb, setRemoveThumb] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // fresh form every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setForm(episode ? fromEpisode(episode) : blank(season));
    setThumbFile(null);
    setRemoveThumb(false);
    setVideoId(null);
    setUploading(false);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, episode?._id, season?._id]);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // warn before leaving the page (links, Back, closing the tab) while a video is uploading or uploaded but not saved
  useLeaveGuard(
    !open
      ? null
      : uploading
      ? "An episode video is still uploading. Leave this page and cancel the upload?"
      : saving
      ? "The episode is still saving. Leave this page anyway?"
      : videoId
      ? "You uploaded an episode video but haven't saved the episode. Leave without saving?"
      : null
  );

  const set = <K extends keyof EpisodeForm>(key: K, value: EpisodeForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (saving) return;
    // closing removes the upload (it is cancelled, and the unsaved video is deleted from Bunny)
    if (uploading) {
      if (!window.confirm("A video is still uploading. Close and cancel the upload?")) return;
      return onOpenChange(false);
    }
    if (videoId && !window.confirm("You uploaded a video but haven't saved the episode. Close without saving?")) return;
    onOpenChange(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Please enter the episode title.";
    const n = Number(form.episodeNumber);
    if (!form.episodeNumber || !Number.isInteger(n) || n < 1) e.episodeNumber = "Episode number must be a whole number like 1, 2, 3.";
    else if ((season?.episodes || []).some((x) => x.episodeNumber === n && x._id !== episode?._id))
      e.episodeNumber = `Episode ${n} already exists in this season.`;
    const start = form.skipIntroStart ? Number(form.skipIntroStart) : 0;
    const end = form.skipIntroEnd ? Number(form.skipIntroEnd) : 0;
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(end) || end < 0) e.skipIntro = "Use seconds, for example 5 and 90.";
    else if ((start || end) && end <= start) e.skipIntro = "The intro end must be after the intro start.";
    if (form.customVideoUrl.trim() && !isValidUrl(form.customVideoUrl)) e.customVideoUrl = "The link must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!season || uploading || saving) return;
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    const sentVideo = videoId;
    const token = beginSave();
    let ok = false;
    try {
      const fd = toFormData({
        title: form.title.trim(),
        episodeNumber: Number(form.episodeNumber),
        description: form.description.trim(),
        // "" = today (see the hint under the date box)
        releaseDate: form.releaseDate,
        isPublished: form.isPublished,
        skipIntroStart: form.skipIntroStart ? Number(form.skipIntroStart) : 0,
        skipIntroEnd: form.skipIntroEnd ? Number(form.skipIntroEnd) : 0,
        customVideoUrl: form.customVideoUrl.trim(),
        videoId: videoId || undefined,
        thumbnail: thumbFile || undefined,
        removeThumbnail: episode && removeThumb && !thumbFile ? true : undefined,
      });
      const base = `/webseries/${seriesId}/seasons/${season._id}/episodes`;
      const { data } = episode ? await api.put(`${base}/${episode._id}`, fd) : await api.post(base, fd);
      ok = true;
      endSave(token, true, [sentVideo]);
      onSaved(data.data);
      toast.success(data.message || "Episode saved");
      setVideoId(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      if (!ok) endSave(token, false);
      if (alive.current) setSaving(false);
    }
  };

  const currentVideo = episode?.videoFile?.videoId ? episode.videoFile : null;

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        className="overflow-y-auto sm:max-w-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{episode ? `Edit episode ${episode.episodeNumber}` : "Add episode"}</DialogTitle>
          <DialogDescription>
            Season {season?.seasonNumber}
            {season?.title && season.title !== `Season ${season.seasonNumber}` ? ` · ${season.title}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="ep-number">Episode no. *</Label>
              <Input id="ep-number" type="number" min={1} step={1} value={form.episodeNumber} onChange={(e) => set("episodeNumber", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-title">Title *</Label>
              <Input id="ep-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. The Beginning" />
            </div>
          </div>
          {(errors.episodeNumber || errors.title) && (
            <div className="-mt-2 space-y-0.5">
              {errors.episodeNumber && <p className="text-xs text-destructive">{errors.episodeNumber}</p>}
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="A short summary of this episode" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ep-date">Release date</Label>
              <Input id="ep-date" type="date" value={form.releaseDate} onChange={(e) => set("releaseDate", e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave empty to use today's date.</p>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <Label htmlFor="ep-pub">Published</Label>
                <p className="text-xs text-muted-foreground">When off, this episode is hidden in the app.</p>
              </div>
              <Switch id="ep-pub" checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Skip intro (in seconds)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" min={0} placeholder="Starts at, e.g. 5" value={form.skipIntroStart} onChange={(e) => set("skipIntroStart", e.target.value)} />
              <Input type="number" min={0} placeholder="Ends at, e.g. 90" value={form.skipIntroEnd} onChange={(e) => set("skipIntroEnd", e.target.value)} />
            </div>
            {errors.skipIntro ? (
              <p className="text-xs text-destructive">{errors.skipIntro}</p>
            ) : (
              <p className="text-xs text-muted-foreground">The app shows a "Skip intro" button between these times. Leave empty if there is no intro.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePicker
              label="Episode image"
              hint="Landscape (16:9). If empty, the app uses a frame from the video."
              aspect="landscape"
              value={rawImage(episode?.thumbnailRaw, episode?.thumbnail)}
              file={thumbFile}
              onChange={setThumbFile}
              removed={episode ? removeThumb : undefined}
              onRemoveChange={episode ? setRemoveThumb : undefined}
            />
            <div className="space-y-3">
              <VideoUploadField
                label="Episode video"
                title={`${seriesTitle} S${season?.seasonNumber ?? ""}E${form.episodeNumber || ""} ${form.title}`.trim()}
                current={currentVideo}
                newVideoId={videoId}
                onUploaded={(vid) => {
                  setVideoId(vid);
                  // the new upload should play → an old pasted link would play instead, so it is cleared
                  if (vid) setForm((f) => (f.customVideoUrl ? { ...f, customVideoUrl: "" } : f));
                }}
                onBusyChange={setUploading}
              />
              <div className="space-y-1.5">
                <Label htmlFor="ep-url">Or a video link</Label>
                <Input id="ep-url" value={form.customVideoUrl} onChange={(e) => set("customVideoUrl", e.target.value)} placeholder="https://…/video.m3u8" />
                {errors.customVideoUrl ? (
                  <p className="text-xs text-destructive">{errors.customVideoUrl}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Only if the video is hosted somewhere else. If filled, this link plays instead of the uploaded video.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 gap-2 border-t bg-background px-6 py-3">
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploading ? "Waiting for upload…" : saving ? "Saving…" : episode ? "Save episode" : "Add episode"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
