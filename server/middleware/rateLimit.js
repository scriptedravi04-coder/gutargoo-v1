// Rate limiter (no extra package needed).
// Example: rateLimit({ windowMs: 10 * 60 * 1000, max: 5, key: (req) => req.body.mobile })
// Counts live in MongoDB so every Cloud Run instance sees the same numbers.
// If MongoDB is down/slow, it falls back to this instance's memory (never blocks the request on a DB error).
const mongoose = require("mongoose");
const RateLimit = require("../models/RateLimit");

let counter = 0;

// Visitor key for per-IP limits. IPv6 users usually get a whole /64 block, so we count the
// first 4 groups (one phone / home = one key); IPv4 (and IPv4-mapped IPv6) stays the full address.
const ipKey = (req) => {
  let ip = String(req.ip || req.socket?.remoteAddress || "").trim().toLowerCase();
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  if (!ip.includes(":")) return ip || "unknown";
  ip = ip.replace(/%.*$/, ""); // zone id (fe80::1%eth0)
  // expand "::" so we can take the first 4 groups
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).map((g) => (g || "0").replace(/^0+(?=.)/, "")).join(":")}::/64`;
};

// skip(req) → true lets the request through without counting it (e.g. a bad mobile number
// that the controller will reject with a clear message anyway)
const rateLimit = ({ windowMs, max, key, message, name, skip }) => {
  // each limiter gets its own name so two limiters never share counts
  // (same code → same order on every instance, so the auto name matches everywhere)
  const prefix = name || `rl${++counter}`;
  const hits = new Map();

  // forget old memory entries every minute so memory never grows
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60 * 1000).unref();

  // memory count (fallback)
  const memoryHit = (id, now) => {
    let entry = hits.get(id);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    return entry;
  };

  // shared count in MongoDB: fixed time windows, one row per window
  const mongoHit = async (id, now) => {
    if (mongoose.connection.readyState !== 1) throw new Error("db not connected");
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const reset = windowStart + windowMs;
    const filter = { key: `${prefix}:${id}:${windowStart}` };
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(reset) } };
    const opts = { upsert: true, returnDocument: "after", maxTimeMS: 2000, lean: true };
    let doc;
    try {
      doc = await RateLimit.findOneAndUpdate(filter, update, opts);
    } catch (err) {
      // two requests created the row at the same moment → just try once more
      if (err.code !== 11000) throw err;
      doc = await RateLimit.findOneAndUpdate(filter, update, opts);
    }
    return { count: doc.count, reset };
  };

  return async (req, res, next) => {
    if (skip && skip(req)) return next();
    // with a key (e.g. mobile number) we count per key; otherwise per IP address
    const id = (key && key(req)) || ipKey(req);
    const now = Date.now();
    let entry;
    try {
      entry = await mongoHit(id, now);
    } catch {
      entry = memoryHit(id, now);
    }
    if (entry.count > max) {
      const wait = Math.max(1, Math.ceil((entry.reset - now) / 1000));
      res.set("Retry-After", String(wait));
      return res.status(429).json({
        success: false,
        message: message || `Too many requests. Try again in ${wait} seconds.`,
      });
    }
    next();
  };
};

module.exports = rateLimit;
module.exports.ipKey = ipKey;
