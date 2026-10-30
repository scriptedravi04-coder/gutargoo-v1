// Helpers that turn uploaded files / Bunny ids into what we store in MongoDB.
const bunny = require("../services/bunnyService");
const { HttpError } = require("./http");

/**
 * Upload one image from a multer file. Returns { url, publicId }, or null when no file was sent.
 * When a file WAS sent but Bunny refuses it, throws a 502 so the admin knows the save did not keep the image.
 */
const uploadImageFile = async (file, prefix) => {
  if (!file) return null;
  try {
    return await bunny.uploadImage(file.path || file.buffer, `${prefix}_${file.originalname}`, file.mimetype);
  } catch (err) {
    console.error(`Image upload failed (${prefix}):`, err.response?.status || err.message);
    throw new HttpError(502, "Image upload failed, please try again");
  }
};

/** Delete Bunny Storage images (best effort, never throws). Skips empty ids and ids still in use (keep list). */
const deleteImages = (ids, keep = []) => {
  const keepSet = new Set(keep.filter(Boolean));
  for (const id of new Set(ids.filter(Boolean))) {
    if (!keepSet.has(id)) Promise.resolve(bunny.deleteImage(id)).catch(() => {});
  }
};

/** First file for a field, e.g. firstFile(req, "logo") */
const firstFile = (req, field) => (req.files && req.files[field] && req.files[field][0]) || null;

/** Video sub-document for a Bunny video id (after a direct upload from the admin panel). */
const videoDocFromBunny = async (videoId) => {
  const info = await bunny.getVideo(videoId);
  return {
    ...bunny.streamUrls(videoId),
    duration: info?.length || 0,
    size: info?.storageSize || 0,
    status: typeof info?.status === "number" ? info.status : bunny.STATUS.UPLOADED,
  };
};

/** Video sub-document for a video file sent through our server (old path). */
const videoDocFromFile = async (file, prefix) => {
  const result = await bunny.uploadVideo(file.path || file.buffer, `${prefix}_${file.originalname}`, file.mimetype);
  return { ...result, duration: 0, size: file.size || 0 };
};

/** true when any movie (video/trailer) or web series (trailer/episode/episode trailer) still uses this Bunny video */
const videoInUse = async (videoId) => {
  // required here (not at the top) so models load only when needed
  const Movie = require("../models/Movie");
  const WebSeries = require("../models/webseries");
  const [movieUses, seriesUses] = await Promise.all([
    Movie.exists({ $or: [{ "movieFile.videoId": videoId }, { "trailer.videoId": videoId }] }),
    WebSeries.exists({
      $or: [
        { "trailer.videoId": videoId },
        { "seasons.episodes.videoFile.videoId": videoId },
        { "seasons.episodes.trailer.videoId": videoId },
      ],
    }),
  ]);
  return !!(movieUses || seriesUses);
};

/** Delete a Bunny video only if no movie or web series uses it (checks both collections). Never throws. */
const deleteVideoIfUnused = async (videoId) => {
  if (!videoId) return;
  try {
    if (!(await videoInUse(videoId))) await bunny.deleteVideo(videoId);
  } catch (err) {
    console.error("Video cleanup check failed (kept):", videoId, err.message);
  }
};

module.exports = { uploadImageFile, firstFile, videoDocFromBunny, videoDocFromFile, deleteImages, videoInUse, deleteVideoIfUnused };
