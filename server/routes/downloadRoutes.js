const router = require("express").Router();
const { getDownloadUrl } = require("../controllers/downloadController");
const { auth } = require("../middleware/authMiddleware");
const { asyncHandler: h } = require("../lib/http");

router.get("/download/:videoId", auth, h(getDownloadUrl));

module.exports = router;
