// Turns every error into a clean JSON reply: { success: false, message }
const multer = require("multer");
const { HttpError } = require("../lib/http");

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large (${err.field}). Images up to 20 MB.`
        : err.code === "LIMIT_UNEXPECTED_FILE"
        ? `Wrong file type or unexpected file field: ${err.field}`
        : err.message;
    return res.status(400).json({ success: false, message: msg });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message });
  if (err.status && err.status < 500) return res.status(err.status).json({ success: false, message: err.message });
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ success: false, message: first?.message || "Invalid data" });
  }
  if (err.name === "CastError") return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
  if (err.code === 11000) return res.status(400).json({ success: false, message: "This already exists" });
  if (err.type === "entity.too.large") return res.status(413).json({ success: false, message: "Request too large" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON" });
  console.error(`❌ ${req.method} ${req.originalUrl}:`, err);
  res.status(err.status || 500).json({ success: false, message: "Something went wrong on the server" });
};
