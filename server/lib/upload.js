// File uploads from the admin panel.
// Files are written to a temp folder (on Cloud Run /tmp is RAM), then sent to Bunny and deleted.
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const { HttpError } = require("./http");

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
// Old "upload video through the server" path. Cloud Run refuses requests over 32 MiB,
// so keep this small — the admin panel uploads real movies straight to Bunny.
const VIDEO_MAX = 30 * 1024 * 1024; // 30 MB
const MAX_FILES = 200; // posters + every new cast/crew photo in one movie save (a big cast must not be refused)

// only normal photo formats (no SVG: it can carry scripts)
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif"];
const isImage = (file) => IMAGE_TYPES.includes(String(file.mimetype).toLowerCase()) && !/\.svgz?$/i.test(file.originalname);
const isVideo = (file) => /^video\//.test(file.mimetype) || /\.(mp4|mov|mkv|webm|m4v)$/i.test(file.originalname);

const VIDEO_TOO_BIG = `Video file too large for server upload (max ${VIDEO_MAX / 1024 / 1024} MB). The admin panel uploads videos directly to Bunny — please use the normal video upload there.`;

const removeFiles = (req) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.fileList)) files.push(...req.fileList);
  else if (req.files) files.push(...(Array.isArray(req.files) ? req.files : Object.values(req.files).flat()));
  for (const f of files) if (f && f.path) fs.unlink(f.path, () => {});
};

// Safety net: delete temp files older than 1 hour (e.g. left by a request that never finished).
// Runs after uploads and also on its own every 10 minutes (timer doesn't keep the process alive).
let lastSweep = 0;
const sweepOld = (force = false) => {
  const now = Date.now();
  if (!force && now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  fs.readdir(TMP_DIR, (err, names) => {
    if (err) return;
    for (const n of names) {
      const p = path.join(TMP_DIR, n);
      fs.stat(p, (e, st) => !e && now - st.mtimeMs > 60 * 60 * 1000 && fs.unlink(p, () => {}));
    }
  });
};
setInterval(() => sweepOld(true), 10 * 60 * 1000).unref();

// Delete temp files after the reply is fully sent ('finish'), so the controller is done with them.
// If the visitor disconnects early ('close' without 'finish') the controller may still be uploading
// to Bunny, so we wait until the controller ends its reply (res.end is still called on a closed
// connection) and remove the files a moment later. If the controller never replies, a 15-minute
// fallback (and the sweep above) removes them.
const AFTER_END_DELAY_MS = 2000;
const ABORT_FALLBACK_MS = 15 * 60 * 1000;
const cleanup = (req, res, next) => {
  let done = false;
  let controllerDone = false;
  let aborted = false;
  const once = () => {
    if (done) return;
    done = true;
    removeFiles(req);
    sweepOld();
  };
  const later = (ms) => setTimeout(once, ms).unref();
  const origEnd = res.end;
  res.end = function (...args) {
    controllerDone = true;
    if (aborted) later(AFTER_END_DELAY_MS);
    return origEnd.apply(this, args);
  };
  res.on("finish", once);
  res.on("close", () => {
    if (res.writableFinished) return once();
    aborted = true;
    later(controllerDone ? AFTER_END_DELAY_MS : ABORT_FALLBACK_MS);
  });
  next();
};

/**
 * upload.images(["logo", "poster"])            → only image fields, 20 MB each
 * upload.media(["poster"], ["movieFile"])      → image fields + video fields
 * upload.images([], /^castImage_\d+$/)         → any image field whose name matches
 */
const build = ({ imageFields = [], videoFields = [], imagePattern = null }) => {
  const m = multer({
    storage,
    // multer has one size limit for all files: videos (if allowed) are bigger, images are re-checked below
    limits: { fileSize: videoFields.length ? Math.max(VIDEO_MAX, IMAGE_MAX) : IMAGE_MAX, files: MAX_FILES },
    fileFilter: (req, file, cb) => {
      if (videoFields.includes(file.fieldname)) {
        return isVideo(file) ? cb(null, true) : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
      }
      if (imageFields.includes(file.fieldname) || (imagePattern && imagePattern.test(file.fieldname))) {
        return isImage(file) ? cb(null, true) : cb(new HttpError(400, `Only JPG, PNG, WEBP or GIF images are allowed (${file.fieldname})`));
      }
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    },
  }).any();

  // a too-big video gets a clear message pointing admins to the direct Bunny upload
  const run = (req, res, next) =>
    m(req, res, (err) => {
      if (err && err.code === "LIMIT_FILE_SIZE" && videoFields.includes(err.field)) return next(new HttpError(413, VIDEO_TOO_BIG));
      next(err);
    });

  return [
    cleanup,
    run,
    // turn req.files (array) into { fieldname: [file] } like multer.fields() does, and check image size
    (req, res, next) => {
      const list = req.files || [];
      req.fileList = list; // keep the flat list (cleanup uses it)
      const map = {};
      for (const f of list) {
        if (!videoFields.includes(f.fieldname) && f.size > IMAGE_MAX) {
          req.files = map;
          return next(new multer.MulterError("LIMIT_FILE_SIZE", f.fieldname));
        }
        (map[f.fieldname] = map[f.fieldname] || []).push(f);
      }
      req.files = map;
      req.body ??= {}; // Express 5: never leave body undefined
      next();
    },
  ];
};

module.exports = {
  images: (fields, pattern) => build({ imageFields: fields, imagePattern: pattern }),
  media: (imageFields, videoFields, pattern) => build({ imageFields, videoFields, imagePattern: pattern }),
  TMP_DIR,
  IMAGE_MAX,
  VIDEO_MAX,
};
