import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { StatusPill } from "./StatusPill";

type Tone = "ok" | "wait" | "bad" | "none";

/**
 * Status pill for a video in a list. While the video is "Processing" a small refresh button
 * asks Bunny right now (the server also saves the new status on the movie / series) and then calls onChecked.
 */
export function VideoStatusPill({ label, tone, videoId, onChecked }: { label: string; tone: Tone; videoId?: string; onChecked?: () => void }) {
  const [busy, setBusy] = useState(false);
  const canCheck = tone === "wait" && !!videoId;

  const check = async () => {
    if (!videoId) return;
    setBusy(true);
    try {
      const { data } = await api.get(`/admin/bunny/videos/${encodeURIComponent(videoId)}`);
      const d = data?.data || {};
      if (d.ready) toast.success("Video is ready to play");
      else if (d.failed) toast.error("Bunny could not process this video. Please upload it again.");
      else toast.message(`Still processing${d.encodeProgress != null ? ` (${d.encodeProgress}%)` : ""}… check again in a few minutes.`);
      onChecked?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <StatusPill tone={tone}>{label}</StatusPill>
      {canCheck && (
        <button
          type="button"
          onClick={check}
          disabled={busy}
          title="Check now"
          aria-label="Check video status now"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
