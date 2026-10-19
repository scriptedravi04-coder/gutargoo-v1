// Uploads a video file straight from the browser to Bunny Stream (TUS protocol).
// The file never passes through our server, so big movies don't time out or crash it.
//
// 1. Ask our backend for an upload session  → { videoId, libraryId, expires, signature, endpoint }
// 2. Create the upload on Bunny (POST)       → Location header = upload URL
// 3. Send the file in chunks (PATCH), resuming after network errors
import { api } from "./api";

export interface UploadSession {
  videoId: string;
  libraryId: string;
  expires: number;
  signature: string;
  endpoint: string;
}

export interface UploadHandle {
  promise: Promise<string>; // resolves with the Bunny videoId
  cancel: () => void;
}

const CHUNK = 25 * 1024 * 1024; // 25 MB
const MAX_RETRIES = 8;

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** resolves when the browser is online again (or right away when it already is / can't tell) */
const waitOnline = (isCancelled: () => boolean) =>
  new Promise<void>((resolve) => {
    if (typeof navigator === "undefined" || navigator.onLine !== false) return resolve();
    const done = () => {
      window.removeEventListener("online", done);
      window.clearInterval(t);
      resolve();
    };
    window.addEventListener("online", done);
    // also stop waiting when the upload is cancelled
    const t = window.setInterval(() => isCancelled() && done(), 1000);
  });

function request(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Blob | null,
  onProgress?: (loaded: number) => void,
  register?: (xhr: XMLHttpRequest) => void
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    register?.(xhr);
    xhr.send(body);
  });
}

/**
 * Best effort: delete a Bunny video that was uploaded here but never saved.
 * The server only deletes it when no movie / series / episode uses it, so this is always safe to call.
 */
export function discardBunnyVideo(videoId?: string | null) {
  if (!videoId) return;
  api.delete(`/admin/bunny/videos/${encodeURIComponent(videoId)}`).catch(() => {
    /* ignore — the video just stays on Bunny */
  });
}

// ───────── "save in progress" tracking ─────────
// While a form is saving, a video uploaded in that form may be about to be attached to the item.
// If the page is left during the save, the unsaved-video cleanup waits for the save to finish and
// only removes the video when that save failed.
let saveSeq = 0;
const savesInFlight = new Set<number>();
const savedVideoIds = new Set<string>();
interface PendingDiscard {
  videoId: string;
  waitFor: Set<number>;
  anySaved: boolean;
}
const pendingDiscards: PendingDiscard[] = [];

/** Call when a save request (that may carry uploaded video ids) starts. Returns a token for endSave. */
export function beginSave(): number {
  const token = ++saveSeq;
  savesInFlight.add(token);
  return token;
}

/** Call when that save request settles. `videoIds` = the uploaded videos the successful save attached. */
export function endSave(token: number, ok: boolean, videoIds: (string | null | undefined)[] = []) {
  if (!savesInFlight.delete(token)) return;
  if (ok) videoIds.forEach((v) => v && savedVideoIds.add(v));
  for (let i = pendingDiscards.length - 1; i >= 0; i--) {
    const p = pendingDiscards[i];
    if (!p.waitFor.delete(token)) continue;
    if (ok) p.anySaved = true;
    if (p.waitFor.size === 0) {
      pendingDiscards.splice(i, 1);
      if (!p.anySaved && !savedVideoIds.has(p.videoId)) discardBunnyVideo(p.videoId);
    }
  }
}

export const isSaveInProgress = () => savesInFlight.size > 0;

/**
 * Remove a video that was uploaded in a form but (probably) never saved.
 * Waits for any save that is still running; skips videos a save already attached.
 */
export function discardUnsavedVideo(videoId?: string | null) {
  if (!videoId || savedVideoIds.has(videoId)) return;
  if (savesInFlight.size === 0) return discardBunnyVideo(videoId);
  pendingDiscards.push({ videoId, waitFor: new Set(savesInFlight), anySaved: false });
}

export function uploadVideoToBunny(
  file: File,
  title: string,
  onProgress: (percent: number) => void,
  /** short note while the upload waits for the internet ("" when it is running normally again) */
  onNote?: (note: string) => void
): UploadHandle {
  let cancelled = false;
  let current: XMLHttpRequest | null = null;
  const register = (x: XMLHttpRequest) => (current = x);

  let createdVideoId: string | null = null;

  const run = async () => {
    const { data } = await api.post("/admin/bunny/upload-session", { title: title || file.name });
    const s: UploadSession = data.data;
    createdVideoId = s.videoId;
    // cancelled while the session was being created → stop before sending anything
    if (cancelled) throw new Error("Upload cancelled");
    const auth = {
      AuthorizationSignature: s.signature,
      AuthorizationExpire: String(s.expires),
      VideoId: s.videoId,
      LibraryId: String(s.libraryId),
      "Tus-Resumable": "1.0.0",
    };

    // create
    const created = await request(
      "POST",
      s.endpoint,
      {
        ...auth,
        "Upload-Length": String(file.size),
        "Upload-Metadata": `filetype ${b64(file.type || "video/mp4")},title ${b64(title || file.name)}`,
      },
      null,
      undefined,
      register
    );
    if (created.status < 200 || created.status >= 300) throw new Error(`Bunny refused the upload (${created.status})`);
    const location = created.getResponseHeader("Location");
    if (!location) throw new Error("Bunny did not return an upload address");
    const uploadUrl = new URL(location, s.endpoint).toString();

    // send chunks
    let offset = 0;
    let retries = 0;
    while (offset < file.size) {
      if (cancelled) throw new Error("Upload cancelled");
      const chunk = file.slice(offset, Math.min(offset + CHUNK, file.size));
      try {
        const res = await request(
          "PATCH",
          uploadUrl,
          { ...auth, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
          chunk,
          (loaded) => onProgress(Math.min(99, Math.floor(((offset + loaded) / file.size) * 100))),
          register
        );
        if (res.status === 204 || res.status === 200) {
          const next = parseInt(res.getResponseHeader("Upload-Offset") || "", 10);
          offset = Number.isFinite(next) ? next : offset + chunk.size;
          if (retries) onNote?.("");
          retries = 0;
          continue;
        }
        throw new Error(`Upload failed (${res.status})`);
      } catch (err) {
        if (cancelled) throw err;
        // phone / wifi dropped → wait for the internet to come back (this does not use up a retry)
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          onNote?.("No internet — the upload continues by itself when you are back online.");
          await waitOnline(() => cancelled);
          if (cancelled) throw err;
        } else if (++retries > MAX_RETRIES) throw err;
        onNote?.("Connection problem — retrying…");
        await sleep(Math.min(30000, 1000 * 2 ** Math.max(1, retries)));
        // ask Bunny how much it already has, then continue from there
        try {
          const head = await request("HEAD", uploadUrl, auth, null, undefined, register);
          const got = parseInt(head.getResponseHeader("Upload-Offset") || "", 10);
          if (Number.isFinite(got)) offset = got;
        } catch {
          /* keep current offset */
        }
      }
    }
    onProgress(100);
    return s.videoId;
  };

  // a cancelled / failed upload leaves an empty video on Bunny → remove it
  const promise = run().catch((err) => {
    discardBunnyVideo(createdVideoId);
    throw err;
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      current?.abort();
    },
  };
}
