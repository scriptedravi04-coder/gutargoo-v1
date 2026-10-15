import { useEffect, useRef, useState } from "react";
import { Film, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, errorMessage, VideoRef, videoStatusLabel } from "@/lib/api";
import { uploadVideoToBunny, UploadHandle } from "@/lib/bunnyUpload";
import { StatusPill } from "./StatusPill";

interface Props {
  label: string;
  title: string; // name used on Bunny
  current?: VideoRef | null; // video already saved on this item
  newVideoId?: string | null; // id of a video uploaded in this form (not saved yet)
  onUploaded: (videoId: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
}

const fmtSize = (b: number) => (b > 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`);

/**
 * Picks a video and uploads it straight to Bunny with a progress bar.
 * The form only gets the Bunny video id, which it sends to the backend on save.
 */
export function VideoUploadField({ label, title, current, newVideoId, onUploaded, onBusyChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<VideoRef | null>(current || null);
  const [checking, setChecking] = useState(false);

  useEffect(() => setStatus(current || null), [current]);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  // stop the upload if the page is closed
  useEffect(() => () => handle.current?.cancel(), []);

  const start = (f: File) => {
    setFile(f);
    setProgress(0);
    setBusy(true);
    const h = uploadVideoToBunny(f, title || f.name, setProgress);
    handle.current = h;
    h.promise
      .then((videoId) => {
        onUploaded(videoId);
        setStatus({ videoId, status: 1 });
        toast.success(`${label} uploaded. Bunny is now processing it (usually a few minutes).`);
      })
      .catch((err) => {
        if (String(err?.message).includes("cancelled")) toast.message("Upload cancelled");
        else toast.error(`${label} upload failed: ${errorMessage(err)}`);
        setFile(null);
      })
      .finally(() => {
        setBusy(false);
        handle.current = null;
      });
  };

  const check = async () => {
    const id = newVideoId || status?.videoId;
    if (!id) return;
    setChecking(true);
    try {
      const { data } = await api.get(`/admin/bunny/videos/${id}`);
      setStatus({ ...status, videoId: id, status: data.data.status });
      if (data.data.ready) toast.success("Video is ready to play");
      else if (data.data.failed) toast.error("Bunny could not process this video. Please upload it again.");
      else toast.message(`Still processing${data.data.encodeProgress != null ? ` (${data.data.encodeProgress}%)` : ""}…`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  const s = videoStatusLabel(status);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Film className="h-4 w-4 text-muted-foreground" />
          {label}
        </div>
        <StatusPill tone={newVideoId && !busy ? "wait" : s.tone}>{newVideoId && !busy ? "Uploaded · not saved yet" : s.label}</StatusPill>
      </div>

      {busy && file ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-[70%]">{file.name}</span>
            <span>
              {progress}% of {fmtSize(file.size)}
            </span>
          </div>
          <Progress value={progress} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Keep this page open until the upload finishes.</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => handle.current?.cancel()}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {status?.videoId || newVideoId ? "Replace video" : "Upload video"}
          </Button>
          {(newVideoId || status?.videoId) && (
            <Button type="button" size="sm" variant="ghost" onClick={check} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Check status
            </Button>
          )}
          {newVideoId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onUploaded(null);
                setFile(null);
                setStatus(current || null);
              }}
            >
              Undo
            </Button>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="video/*,.mkv,.mov,.mp4"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) start(f);
        }}
      />
    </div>
  );
}
