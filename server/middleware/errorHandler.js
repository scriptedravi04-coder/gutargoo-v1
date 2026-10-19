// Turns every error into a clean JSON reply: { success: false, message }
const multer = require("multer");
const { HttpError } = require("../lib/http");

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    console.error(`❌ ${req.method} ${req.originalUrl} (after reply started):`, err);
    return res.end();
  }
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large (${err.field}). Images up to 20 MB.`
        : err.code === "LIMIT_FILE_COUNT"
        ? "Too many files in one upload"
        : err.code === "LIMIT_UNEXPECTED_FILE"
        ? `Wrong file type or unexpected file field: ${err.field}`
        : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  // broken multipart upload (connection dropped, bad form) from multer/busboy
  if (/Unexpected end of form|Malformed part header|Multipart: Boundary not found/i.test(err.message || "")) {
    return res.status(400).json({ success: false, message: "Upload was interrupted. Please try again." });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
  // body-parser errors (bad JSON, too large…) carry a status + "type"; their messages are safe to show
  if (err.type && err.status && err.status < 500) {
    if (err.type === "entity.too.large") return res.status(413).json({ success: false, message: "Request too large" });
    if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON" });
    return res.status(err.status).json({ success: false, message: "Invalid request body" });
  }
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ success: false, message: first?.message || "Invalid data" });
  }
  // two saves of the same item at once (e.g. two episode edits) → ask to reload instead of a vague 500
  if (err.name === "VersionError") return res.status(409).json({ success: false, message: "This item was changed at the same time somewhere else. Reload the page and try again." });
  if (err.name === "CastError") return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  if (err.code === 11000) return res.status(400).json({ success: false, message: "This already exists" });
  // anything else is a bug or an outside service failing: log it all, show a generic message
  // (never trust err.status from libraries like axios — that's Bunny's status, not ours)
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ success: false, message: "Something went wrong on the server" });
};
