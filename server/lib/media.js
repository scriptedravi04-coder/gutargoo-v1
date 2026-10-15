// Helpers that turn uploaded files / Bunny ids into what we store in MongoDB.
const bunny = require("../services/bunnyService");

/** Upload one image from a multer file. Returns { url, publicId } or null (never throws). */
const uploadImageFile = async (file, prefix) => {
  if (!file) return null;
  try {
    return await bunny.uploadImage(file.path || file.buffer, `${prefix}_${file.originalname}`, file.mimetype);
  } catch (err) {
    console.error(`Image upload failed (${prefix}):`, err.response?.status || err.message);
    return null;
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

module.exports = { uploadImageFile, firstFile, videoDocFromBunny, videoDocFromFile };
