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

export function uploadVideoToBunny(file: File, title: string, onProgress: (percent: number) => void): UploadHandle {
  let cancelled = false;
  let current: XMLHttpRequest | null = null;
  const register = (x: XMLHttpRequest) => (current = x);

  const promise = (async () => {
    const { data } = await api.post("/admin/bunny/upload-session", { title: title || file.name });
    const s: UploadSession = data.data;
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
          retries = 0;
          continue;
        }
        throw new Error(`Upload failed (${res.status})`);
      } catch (err) {
        if (cancelled) throw err;
        if (++retries > MAX_RETRIES) throw err;
        await sleep(Math.min(30000, 1000 * 2 ** retries));
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
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      current?.abort();
    },
  };
}
