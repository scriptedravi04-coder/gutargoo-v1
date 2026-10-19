// Bunny Stream calls this when a video's status changes (set it in Bunny → Stream → Library → Webhook URL:
//   https://admin.gutargooplus.com/api/bunny/webhook ).
// We never trust the body: we only use the video id, then ask Bunny for the real status.
const crypto = require("crypto");
const router = require("express").Router();
const { syncVideo, runOnce } = require("../services/videoStatusSync");
const rateLimit = require("../middleware/rateLimit");
const { asyncHandler: h, HttpError } = require("../lib/http");

// Bunny video ids are GUIDs: 8-4-4-4-12 hex characters
const GUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// stops strangers from making us call Bunny thousands of times
const webhookLimit = rateLimit({ windowMs: 60 * 1000, max: 120, key: (req) => `bunny-wh:${req.ip}` });
const syncLimit = rateLimit({ windowMs: 60 * 1000, max: 10, key: (req) => `bunny-sync:${req.ip}` });

router.post(
  "/webhook",
  webhookLimit,
  h(async (req, res) => {
    const libraryId = String(req.body?.VideoLibraryId || "");
    const videoId = String(req.body?.VideoGuid || "");
    if (libraryId && libraryId !== String(process.env.BUNNY_LIBRARY_ID)) return res.json({ success: true, ignored: true });
    if (!GUID.test(videoId)) return res.json({ success: true, ignored: true });
    await syncVideo(videoId);
    res.json({ success: true });
  })
);

// POST /api/bunny/sync — one "check processing videos" pass.
// For Cloud Scheduler (Cloud Run has no CPU between requests, so the built-in timer can't be relied on).
// Needs header  x-sync-key: <SYNC_KEY>. Turned off when SYNC_KEY is not set.
router.post(
  "/sync",
  syncLimit,
  h(async (req, res) => {
    const expected = String(process.env.SYNC_KEY || "").trim();
    if (!expected) throw new HttpError(404, "Not found");
    const given = String(req.headers["x-sync-key"] || "");
    const a = crypto.createHash("sha256").update(given).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Wrong sync key");
    const checked = await runOnce();
    res.json({ success: true, checked });
  })
);

module.exports = router;
