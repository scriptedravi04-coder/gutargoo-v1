// Small helpers shared by all controllers.
const mongoose = require("mongoose");

// Throw this inside a controller to send a clean error: throw new HttpError(404, "Movie not found")
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap async route handlers so thrown errors go to the error handler instead of crashing.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v);

// multipart forms can send the same field twice → multer gives an array; take the last value
const last = (v) => (Array.isArray(v) ? v[v.length - 1] : v);

const parseBool = (v, fallback = undefined) => {
  v = last(v);
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true" || v === "1" || v === 1;
};

const parseNum = (v, fallback = undefined) => {
  v = last(v);
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const parseStr = (v, fallback = undefined) => {
  v = last(v);
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
};

// Accepts a real array, a JSON string '["a","b"]' or a comma list "a, b"
const parseArray = (v) => {
  v = Array.isArray(v) && v.length === 1 && typeof v[0] === "string" && v[0].startsWith("[") ? v[0] : v;
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
};

const parseJSON = (v, fallback = undefined) => {
  v = last(v);
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

const parseDate = (v) => {
  v = last(v);
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ?page=1&limit=20 → { page, limit, skip }  (limit capped at 200)
const paging = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = {
  HttpError,
  asyncHandler,
  isId,
  last,
  parseBool,
  parseNum,
  parseStr,
  parseArray,
  parseJSON,
  parseDate,
  escapeRegex,
  paging,
};
