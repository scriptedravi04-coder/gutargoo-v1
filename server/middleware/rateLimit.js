// Tiny in-memory rate limiter (no extra package needed).
// Example: rateLimit({ windowMs: 10 * 60 * 1000, max: 5, key: (req) => req.body.mobile })
// Counts are kept in this server's memory, so they reset when the server restarts.
const rateLimit = ({ windowMs, max, key, message }) => {
  const hits = new Map();

  // forget old entries every minute so memory never grows
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60 * 1000).unref();

  return (req, res, next) => {
    // with a key (e.g. mobile number) we count per key; otherwise per IP address
    const id = (key && key(req)) || req.ip;
    const now = Date.now();
    let entry = hits.get(id);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(id, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const wait = Math.ceil((entry.reset - now) / 1000);
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
