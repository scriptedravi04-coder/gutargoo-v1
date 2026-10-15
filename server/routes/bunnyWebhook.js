// Bunny Stream calls this when a video's status changes (set it in Bunny → Stream → Library → Webhook URL:
//   https://admin.gutargooplus.com/api/bunny/webhook ).
// We never trust the body: we only use the video id, then ask Bunny for the real status.
const router = require("express").Router();
const { syncVideo } = require("../services/videoStatusSync");
const { asyncHandler: h } = require("../lib/http");

router.post(
  "/webhook",
  h(async (req, res) => {
    const libraryId = String(req.body?.VideoLibraryId || "");
    const videoId = String(req.body?.VideoGuid || "");
    if (libraryId && libraryId !== String(process.env.BUNNY_LIBRARY_ID)) return res.json({ success: true, ignored: true });
    if (/^[a-f0-9-]{36}$/i.test(videoId)) await syncVideo(videoId);
    res.json({ success: true });
  })
);

module.exports = router;
