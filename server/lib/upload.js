// File uploads from the admin panel.
// Files are written to a temp folder (not kept in RAM), then sent to Bunny and deleted.
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");

const TMP_DIR = path.join(os.tmpdir(), "gutargoo-uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: TMP_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safe}`);
  },
});

const IMAGE_MAX = 20 * 1024 * 1024; // 20 MB
const VIDEO_MAX = 5 * 1024 * 1024 * 1024; // 5 GB (only for the old "upload through server" path)

const isImage = (file) => /^image\//.test(file.mimetype);
const isVideo = (file) => /^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm|m4v)$/i.test(file.originalname);

// Delete temp files once the response is finished (success or error).
const cleanup = (req, res, next) => {
  res.on("close", () => {
    const files = [];
    if (req.file) files.push(req.file);
    if (req.files) {
      const all = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
      files.push(...all);
    }
    for (const f of files) if (f && f.path) fs.unlink(f.path, () => {});
  });
  next();
};

/**
 * upload.images(["logo", "poster"])            → only image fields, 20 MB each
 * upload.media(["poster"], ["movieFile"])      → image fields + video fields
 * upload.dynamicImages(/^castImage_\d+$/)      → any image field whose name matches
 */
const build = ({ imageFields = [], videoFields = [], imagePattern = null }) => {
  const m = multer({
    storage,
    limits: { fileSize: videoFields.length ? VIDEO_MAX : IMAGE_MAX, files: 200 },
    fileFilter: (req, file, cb) => {
      if (videoFields.includes(file.fieldname)) {
        return isVideo(file) ? cb(null, true) : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
      }
      if (imageFields.includes(file.fieldname) || (imagePattern && imagePattern.test(file.fieldname))) {
        return isImage(file) ? cb(null, true) : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
      }
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    },
  }).any();

  return [
    cleanup,
    m,
    // turn req.files (array) into { fieldname: [file] } like multer.fields() does, and check image size
    (req, res, next) => {
      const map = {};
      for (const f of req.files || []) {
        if (!videoFields.includes(f.fieldname) && f.size > IMAGE_MAX) {
          return next(new multer.MulterError("LIMIT_FILE_SIZE", f.fieldname));
        }
        (map[f.fieldname] = map[f.fieldname] || []).push(f);
      }
      req.fileList = req.files || [];
      req.files = map;
      next();
    },
  ];
};

module.exports = {
  images: (fields, pattern) => build({ imageFields: fields, imagePattern: pattern }),
  media: (imageFields, videoFields, pattern) => build({ imageFields, videoFields, imagePattern: pattern }),
  TMP_DIR,
};
