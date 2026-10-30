const router = require("express").Router();
const c = require("../controllers/movieController");
const { adminAuth, detectAdmin } = require("../middleware/authMiddleware");
const upload = require("../lib/upload");
const { asyncHandler: h } = require("../lib/http");

// Posters + people photos (crewImages_<role>_<i>, castImage_<i>) + optional video files.
// Normally videos go straight from the admin panel to Bunny and only the Bunny id is sent here.
const movieUpload = upload.media(
  ["logo", "horizontalBanner", "verticalPoster"],
  ["movieFile", "trailerFile"],
  /^(crewImages_[a-zA-Z]+_\d+|castImage_\d+)$/
);

// App + admin (admin sees drafts too)
router.get("/", detectAdmin, h(c.getMovies));
router.get("/options", adminAuth, h(c.getMovieOptions));
router.get("/:id", detectAdmin, h(c.getMovieById));
router.get("/:id/stream", detectAdmin, h(c.getVideoStreamUrl));

// Admin only
router.post("/", adminAuth, movieUpload, h(c.createMovie));
router.put("/:id", adminAuth, movieUpload, h(c.updateMovie));
router.delete("/:id", adminAuth, h(c.deleteMovie));
router.patch("/:id/publish", adminAuth, h(c.togglePublish));

module.exports = router;
