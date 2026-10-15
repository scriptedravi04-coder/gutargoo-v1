// Keeps "processing" videos up to date.
// Bunny takes a few minutes to encode a video. Until it is ready we store status 1–3;
// this service asks Bunny every few minutes and writes the real status into MongoDB.
// Bunny can also call POST /api/bunny/webhook the moment encoding finishes.
const Movie = require("../models/Movie");
const WebSeries = require("../models/webseries");
const bunny = require("./bunnyService");

const PENDING = { $nin: [bunny.STATUS.READY, bunny.STATUS.ERROR, bunny.STATUS.UPLOAD_FAILED] };

/** Fetch one video's status from Bunny and save it everywhere it is used. Returns Bunny's info or null. */
const syncVideo = async (videoId) => {
  if (!videoId) return null;
  const info = await bunny.getVideo(videoId);
  if (!info || typeof info.status !== "number") return info;
  const set = (path) => ({
    [`${path}.status`]: info.status,
    ...(info.length ? { [`${path}.duration`]: info.length } : {}),
  });
  const opts = { timestamps: false }; // a status check is not an edit
  await Movie.updateMany({ "movieFile.videoId": videoId }, { $set: set("movieFile") }, opts);
  await Movie.updateMany({ "trailer.videoId": videoId }, { $set: set("trailer") }, opts);
  await WebSeries.updateMany({ "trailer.videoId": videoId }, { $set: set("trailer") }, opts);
  await WebSeries.updateMany(
    { "seasons.episodes.videoFile.videoId": videoId },
    { $set: set("seasons.$[].episodes.$[ep].videoFile") },
    { arrayFilters: [{ "ep.videoFile.videoId": videoId }], timestamps: false }
  );
  return info;
};

/** One pass: find videos that are still processing (added in the last 3 days) and refresh them. */
const syncPending = async () => {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const ids = new Set();
  const movies = await Movie.find(
    {
      updatedAt: { $gte: since },
      $or: [
        { "movieFile.videoId": { $nin: [null, ""] }, "movieFile.status": PENDING },
        { "trailer.videoId": { $nin: [null, ""] }, "trailer.status": PENDING },
      ],
    },
    "movieFile trailer"
  ).limit(30).lean();
  for (const m of movies) {
    if (m.movieFile?.videoId && !bunny.isFinalStatus(m.movieFile.status)) ids.add(m.movieFile.videoId);
    if (m.trailer?.videoId && !bunny.isFinalStatus(m.trailer.status)) ids.add(m.trailer.videoId);
  }
  const series = await WebSeries.find(
    {
      updatedAt: { $gte: since },
      $or: [
        { "trailer.videoId": { $nin: [null, ""] }, "trailer.status": PENDING },
        { "seasons.episodes": { $elemMatch: { "videoFile.videoId": { $nin: [null, ""] }, "videoFile.status": PENDING } } },
      ],
    },
    "trailer seasons.episodes.videoFile"
  ).limit(50).lean();
  for (const w of series) {
    if (w.trailer?.videoId && !bunny.isFinalStatus(w.trailer.status)) ids.add(w.trailer.videoId);
    for (const s of w.seasons || []) {
      for (const e of s.episodes || []) {
        if (e.videoFile?.videoId && !bunny.isFinalStatus(e.videoFile.status)) ids.add(e.videoFile.videoId);
      }
    }
  }
  for (const id of [...ids].slice(0, 40)) await syncVideo(id);
  return ids.size;
};

let timer = null;
const start = (everyMs = 3 * 60 * 1000) => {
  if (timer || !process.env.BUNNY_VIDEO_API_KEY) return;
  const run = () => syncPending().catch((err) => console.error("Video status sync failed:", err.message));
  timer = setInterval(run, everyMs);
  timer.unref();
  setTimeout(run, 20 * 1000).unref();
};

module.exports = { syncVideo, syncPending, start };
