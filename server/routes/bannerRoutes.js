const router = require("express").Router();
const c = require("../controllers/bannerController");
const { adminAuth, detectAdmin } = require("../middleware/authMiddleware");
const upload = require("../lib/upload");
const { asyncHandler: h } = require("../lib/http");

const bannerUpload = upload.images(["logoImage", "bannerImage"]);

// App + admin
router.get("/", detectAdmin, h(c.getBanners));
router.get("/movies-dropdown", adminAuth, h(c.getMoviesForDropdown));
router.put("/reorder", adminAuth, h(c.reorder));
router.get("/:id", detectAdmin, h(c.getBannerById));

// Admin
router.post("/", adminAuth, bannerUpload, h(c.createBanner));
router.put("/:id", adminAuth, bannerUpload, h(c.updateBanner));
router.delete("/:id", adminAuth, h(c.deleteBanner));
router.patch("/:id/toggle-publish", adminAuth, h(c.togglePublish));

module.exports = router;
