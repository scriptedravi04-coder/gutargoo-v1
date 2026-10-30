// View counts: the app opens a title's detail page many times, so a view is counted at most
// once per viewer (logged-in app user, else IP / IPv6 /64) per title per 6 hours.
const jwt = require("jsonwebtoken");
const ViewHit = require("../models/ViewHit");
const { ipKey } = require("../middleware/rateLimit");

const WINDOW_MS = 6 * 60 * 60 * 1000;

// who is watching: customer id from the app token (no DB lookup), else the IP
const viewerKey = (req) => {
  const own = String(req.headers["x-gg-token"] || "").trim();
  const header = own ? `Bearer ${own}` : req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    try {
      const d = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      const id = String(d?.id ?? "");
      if (d?.role === "customer" && /^[a-f0-9]{24}$/i.test(id)) return `c:${id}`;
    } catch {
      /* not logged in → IP */
    }
  }
  return `ip:${ipKey(req)}`;
};

// true when this view should be counted (first one in the window)
const firstViewInWindow = async (key) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  try {
    await ViewHit.create({ key, expiresAt });
    return true;
  } catch (err) {
    if (err.code !== 11000) throw err;
    // the marker exists; if it already expired (MongoDB removes old rows only about once a minute) renew it
    const r = await ViewHit.updateOne({ key, expiresAt: { $lte: now } }, { $set: { expiresAt } });
    return r.modifiedCount === 1;
  }
};

/** Fire-and-forget: +1 viewCount on Model/_id unless this viewer was counted recently. Never throws. */
const countView = (Model, kind, id, req) => {
  const key = `${kind}:${id}:${viewerKey(req)}`;
  firstViewInWindow(key)
    .then((count) => count && Model.updateOne({ _id: id }, { $inc: { viewCount: 1 } }, { timestamps: false }))
    .catch(() => {});
};

module.exports = { countView };
