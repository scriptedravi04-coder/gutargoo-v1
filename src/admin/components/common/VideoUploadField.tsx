import { useEffect, useRef, useState } from "react";
import { Film, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, errorMessage, VideoRef, videoStatusLabel } from "@/lib/api";
import { discardUnsavedVideo, uploadVideoToBunny, UploadHandle } from "@/lib/bunnyUpload";
import { StatusPill } from "./StatusPill";

interface Props {
  label: string;
  title: string; // name used on Bunny
  current?: VideoRef | null; // video already saved on this item
  newVideoId?: string | null; // id of a video uploaded in this form (not saved yet)
  onUploaded: (videoId: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
  /** called with the chosen file (e.g. to fill the title and length); may return the name to use on Bunny */
  onFilePicked?: (file: File) => string | void;
}

const fmtSize = (b: number) => (b > 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`);

/**
 * Picks a video and uploads it straight to Bunny with a progress bar.
 * The form only gets the Bunny video id, which it sends to the backend on save.
 */
export function VideoUploadField({ label, title, current, newVideoId, onUploaded, onBusyChange, onFilePicked }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<VideoRef | null>(current || null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => setStatus(current || null), [current]);
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  // latest unsaved upload (the form clears newVideoId after a successful save)
  const unsaved = useRef<string | null>(newVideoId || null);
  useEffect(() => {
    unsaved.current = newVideoId || null;
  }, [newVideoId]);
  const busyCb = useRef(onBusyChange);
  busyCb.current = onBusyChange;
  const alive = useRef(true);
  // page / dialog closed: stop the upload, and remove a video that was uploaded but never saved.
  // If a save is still running, the removal waits and only happens when that save failed
  // (the server also keeps a video that something already uses).
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      handle.current?.cancel();
      busyCb.current?.(false);
      discardUnsavedVideo(unsaved.current);
    };
  }, []);

  const start = (f: File) => {
    setFile(f);
    const picked = onFilePicked?.(f);
    setProgress(0);
    setNote("");
    setBusy(true);
    const h = uploadVideoToBunny(f, (picked && picked.trim()) || title || f.name, setProgress, (n) => alive.current && setNote(n));
    handle.current = h;
    h.promise
      .then((videoId) => {
        // finished after the field was closed → nobody will save it
        if (!alive.current) {
          discardUnsavedVideo(videoId);
          return;
        }
        // a previous upload from this form that was never saved is replaced → remove it from Bunny
        if (unsaved.current && unsaved.current !== videoId) discardUnsavedVideo(unsaved.current);
        unsaved.current = videoId;
        onUploaded(videoId);
        setStatus({ videoId, status: 1 });
        toast.success(`${label} uploaded. Bunny is now processing it (usually a few minutes).`);
      })
      .catch((err) => {
        if (!alive.current) return;
        if (String(err?.message).includes("cancelled")) toast.message("Upload cancelled");
        else toast.error(`${label} upload failed: ${errorMessage(err)}`);
        setFile(null);
      })
      .finally(() => {
        if (handle.current === h) handle.current = null;
        if (!alive.current) return;
        setBusy(false);
        setNote("");
      });
  };

  // asks Bunny for the real status (the server also saves it on the movie / series that uses this video)
  const check = async (silent = false) => {
    const id = newVideoId || status?.videoId;
    if (!id) return;
    if (!silent) setChecking(true);
    try {
      const { data } = await api.get(`/admin/bunny/videos/${encodeURIComponent(id)}`);
      if (!alive.current) return;
      setStatus((prev) => ({ ...(prev || {}), videoId: id, status: data.data.status }));
      if (data.data.ready) toast.success(`${label} is ready to play`);
      else if (data.data.failed) toast.error(`Bunny could not process the ${label.toLowerCase()}. Please upload it again.`);
      else if (!silent) toast.message(`Still processing${data.data.encodeProgress != null ? ` (${data.data.encodeProgress}%)` : ""}… this page checks again by itself.`);
    } catch (err) {
      if (!silent && alive.current) toast.error(errorMessage(err));
    } finally {
      if (!silent && alive.current) setChecking(false);
    }
  };

  const s = videoStatusLabel(status);
  // still processing → check by itself every minute while this page is open (no need to keep pressing the button)
  const pollId = !busy && (newVideoId || status?.videoId) && (newVideoId ? !(status?.status === 4 || status?.status === 5 || status?.status === 6) : s.tone === "wait") ? newVideoId || status?.videoId : null;
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (!pollId) return;
    const t = window.setInterval(() => void checkRef.current(true), 60_000);
    return () => window.clearInterval(t);
  }, [pollId]);

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
            <p className={note ? "text-xs text-amber-600" : "text-xs text-muted-foreground"}>{note || "Keep this page open until the upload finishes."}</p>
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
            <Button type="button" size="sm" variant="ghost" onClick={() => void check()} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Check now
            </Button>
          )}
          {newVideoId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                discardUnsavedVideo(newVideoId);
                unsaved.current = null;
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
