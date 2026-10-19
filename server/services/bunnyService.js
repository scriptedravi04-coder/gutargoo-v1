// Everything that talks to Bunny CDN lives here.
//  - Bunny Stream  = movies, trailers, episodes (HLS video)
//  - Bunny Storage = images (posters, banners, logos, photos)
//
// Public links:
//  On the live server, videos and images are served through admin.gutargooplus.com
//  (/stream/... and /storage/...) instead of *.b-cdn.net, so they also work on
//  networks that block b-cdn.net. Set these in .env:
//    BUNNY_STREAM_PUBLIC_BASE=https://admin.gutargooplus.com/stream
//    BUNNY_STORAGE_PUBLIC_BASE=https://admin.gutargooplus.com/storage
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");

const env = (k, d = "") => (process.env[k] || d).trim();
const noSlash = (s) => s.replace(/\/+$/, "");

const config = () => {
  const libraryId = env("BUNNY_LIBRARY_ID");
  const storageZone = env("BUNNY_STORAGE_ZONE");
  const cdnHost = env("BUNNY_CDN_HOSTNAME");
  return {
    apiKey: env("BUNNY_VIDEO_API_KEY"),
    libraryId,
    storageZone,
    storagePassword: env("BUNNY_STORAGE_PASSWORD"),
    storageHost: env("BUNNY_STORAGE_HOST", "storage.bunnycdn.com"),
    streamBase: noSlash(env("BUNNY_STREAM_PUBLIC_BASE") || (cdnHost ? `https://${cdnHost}` : "")),
    // the real Bunny CDN address (used for big MP4 downloads so they don't pass through our server)
    cdnBase: cdnHost ? `https://${cdnHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}` : "",
    storageBase: noSlash(env("BUNNY_STORAGE_PUBLIC_BASE") || (storageZone ? `https://${storageZone}.b-cdn.net` : "")),
    apiBase: `https://video.bunnycdn.com/library/${libraryId}`,
  };
};

// Bunny Stream video status codes
const STATUS = { CREATED: 0, UPLOADED: 1, PROCESSING: 2, TRANSCODING: 3, READY: 4, ERROR: 5, UPLOAD_FAILED: 6 };
const isFinalStatus = (s) => s === STATUS.READY || s === STATUS.ERROR || s === STATUS.UPLOAD_FAILED;

/** All public links for one Bunny video id. */
const streamUrls = (videoId) => {
  const { streamBase, libraryId } = config();
  return {
    videoId,
    url: `${streamBase}/${videoId}/playlist.m3u8`,
    hlsUrl: `${streamBase}/${videoId}/playlist.m3u8`,
    mp4Url: `${streamBase}/${videoId}/play_720p.mp4`,
    directPlayUrl: `https://player.mediadelivery.net/play/${libraryId}/${videoId}`,
    thumbnailUrl: `${streamBase}/${videoId}/thumbnail.jpg`,
  };
};

const apiHeaders = () => ({ AccessKey: config().apiKey, Accept: "application/json" });

/** Video info from Bunny (status, length, resolutions…) or null. */
const getVideo = async (videoId, { notFoundMarker = false } = {}) => {
  try {
    const res = await axios.get(`${config().apiBase}/videos/${videoId}`, { headers: apiHeaders(), timeout: 15000 });
    return res.data;
  } catch (err) {
    // with notFoundMarker, a video Bunny doesn't have returns { notFound: true } instead of null
    if (notFoundMarker && err.response?.status === 404) return { notFound: true };
    console.error("Bunny getVideo failed:", videoId, err.response?.status || err.message);
    return null;
  }
};

const createVideo = async (title) => {
  const res = await axios.post(
    `${config().apiBase}/videos`,
    { title: String(title || "Untitled").slice(0, 200) },
    { headers: { ...apiHeaders(), "Content-Type": "application/json" }, timeout: 15000 }
  );
  return res.data; // { guid, ... }
};

/**
 * Lets the admin panel upload a video straight to Bunny (TUS protocol), so big
 * movies never pass through our server. Valid for 12 hours.
 */
const createUploadSession = async (title) => {
  const { apiKey, libraryId } = config();
  const video = await createVideo(title);
  const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const signature = crypto.createHash("sha256").update(`${libraryId}${apiKey}${expires}${video.guid}`).digest("hex");
  return {
    videoId: video.guid,
    libraryId,
    expires,
    signature,
    endpoint: "https://video.bunnycdn.com/tusupload",
  };
};

/** Old path: upload a video file that is already on our server (temp file or buffer). */
const uploadVideo = async (fileOrBuffer, title, mimeType = "video/mp4") => {
  const video = await createVideo(title);
  const body = typeof fileOrBuffer === "string" ? fs.createReadStream(fileOrBuffer) : fileOrBuffer;
  const headers = { ...apiHeaders(), "Content-Type": mimeType };
  if (typeof fileOrBuffer === "string") headers["Content-Length"] = fs.statSync(fileOrBuffer).size;
  await axios.put(`${config().apiBase}/videos/${video.guid}`, body, {
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 0,
  });
  return { ...streamUrls(video.guid), status: STATUS.UPLOADED };
};

const deleteVideo = async (videoId) => {
  if (!videoId) return;
  try {
    await axios.delete(`${config().apiBase}/videos/${videoId}`, { headers: apiHeaders(), timeout: 15000 });
  } catch (err) {
    console.error("Bunny deleteVideo failed:", videoId, err.response?.status || err.message);
  }
};

/** Upload an image (buffer or temp-file path) to Bunny Storage. Returns { url, publicId }. */
const uploadImage = async (fileOrBuffer, fileName, mimeType = "image/jpeg") => {
  const { storageZone, storagePassword, storageHost, storageBase } = config();
  const safeName = `${Date.now()}_${String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100)}`;
  const body = typeof fileOrBuffer === "string" ? fs.readFileSync(fileOrBuffer) : fileOrBuffer;
  await axios.put(`https://${storageHost}/${storageZone}/${safeName}`, body, {
    headers: { AccessKey: storagePassword, "Content-Type": mimeType },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000,
  });
  return { url: `${storageBase}/${safeName}`, publicId: safeName };
};

const deleteImage = async (publicId) => {
  if (!publicId) return;
  const { storageZone, storagePassword, storageHost } = config();
  try {
    await axios.delete(`https://${storageHost}/${storageZone}/${publicId}`, {
      headers: { AccessKey: storagePassword },
      timeout: 15000,
    });
  } catch (err) {
    console.error("Bunny deleteImage failed:", publicId, err.response?.status || err.message);
  }
};

/**
 * A direct MP4 link for offline download, or null if Bunny has no MP4 for this video.
 * (Bunny library setting "MP4 fallback" must be ON for downloads to work.)
 *
 * Which address the link uses:
 *  - default: BUNNY_STREAM_PUBLIC_BASE (the /stream proxy, e.g. admin.gutargooplus.com/stream —
 *    needed on mobile networks that block b-cdn.net), EXCEPT when that base is this same server
 *    on Cloud Run (Cloud Run serving its own /stream) → big MP4s go straight to https://BUNNY_CDN_HOSTNAME.
 *    (On the old VPS the same host is fine: nginx serves /stream there, not Node.)
 *  - DOWNLOAD_VIA=cdn   → always the Bunny CDN address
 *  - DOWNLOAD_VIA=proxy → always BUNNY_STREAM_PUBLIC_BASE
 * requestHost = the Host the app called us on (req.hostname), used for the "same server" check.
 */
const hostOf = (u) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const downloadBase = (requestHost) => {
  const { cdnBase, streamBase } = config();
  const via = env("DOWNLOAD_VIA").toLowerCase();
  if (via === "cdn") return cdnBase || streamBase;
  if (via === "proxy") return streamBase || cdnBase;
  const reqHost = String(requestHost || "").toLowerCase().replace(/:\d+$/, "");
  const onCloudRun = !!process.env.K_SERVICE; // Cloud Run always sets K_SERVICE
  if (cdnBase && streamBase && reqHost && onCloudRun && hostOf(streamBase) === reqHost) return cdnBase;
  return streamBase || cdnBase;
};

const mp4DownloadUrl = async (videoId, requestHost) => {
  const video = await getVideo(videoId);
  if (!video || video.status !== STATUS.READY) return null;
  if (video.hasMP4Fallback === false) return null;
  const resolutions = String(video.availableResolutions || "")
    .split(",")
    .map((r) => parseInt(r, 10))
    .filter((n) => n > 0 && n <= 720)
    .sort((a, b) => b - a);
  // no resolution reported → we'd only be guessing a file name that may not exist → "not available"
  if (!resolutions.length) return null;
  const base = downloadBase(requestHost);
  if (!base) return null;
  return `${base}/${videoId}/play_${resolutions[0]}p.mp4`;
};

module.exports = {
  STATUS,
  isFinalStatus,
  config,
  streamUrls,
  getVideo,
  createUploadSession,
  uploadVideo,
  deleteVideo,
  uploadImage,
  deleteImage,
  mp4DownloadUrl,
  downloadBase,
};
