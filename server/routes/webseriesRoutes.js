const router = require("express").Router();
const c = require("../controllers/webSeriesController");
const { adminAuth, detectAdmin } = require("../middleware/authMiddleware");
const upload = require("../lib/upload");
const { asyncHandler: h } = require("../lib/http");

const seriesImages = upload.images(["thumbnail", "verticalPoster", "banner"]);
const episodeImage = upload.images(["thumbnail"]);

// App + admin
router.get("/", detectAdmin, h(c.getAll));
router.get("/options", adminAuth, h(c.getOptions));
router.get("/:id", detectAdmin, h(c.getById));

// Admin: series
router.post("/", adminAuth, seriesImages, h(c.create));
router.put("/:id", adminAuth, seriesImages, h(c.update));
router.delete("/:id", adminAuth, h(c.remove));
router.patch("/:id/publish", adminAuth, h(c.togglePublish));

// Admin: seasons
router.post("/:id/seasons", adminAuth, h(c.addSeason));
router.put("/:id/seasons/:seasonId", adminAuth, h(c.updateSeason));
router.delete("/:id/seasons/:seasonId", adminAuth, h(c.deleteSeason));

// Admin: episodes (video goes straight to Bunny; send its id as `videoId`)
router.post("/:id/seasons/:seasonId/episodes", adminAuth, episodeImage, h(c.addEpisode));
router.put("/:id/seasons/:seasonId/episodes/:episodeId", adminAuth, episodeImage, h(c.updateEpisode));
router.delete("/:id/seasons/:seasonId/episodes/:episodeId", adminAuth, h(c.deleteEpisode));

module.exports = router;
