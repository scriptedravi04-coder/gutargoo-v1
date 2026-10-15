const router = require("express").Router();
const c = require("../controllers/homeSectionController");
const { adminAuth } = require("../middleware/authMiddleware");
const { asyncHandler: h } = require("../lib/http");

// App home screen (public). The app calls /alllist — route matching ignores case.
router.get("/sections/allList", h(c.getSectionsMobile));

// Admin
router.get("/sections", adminAuth, h(c.getSections));
router.post("/sections", adminAuth, h(c.createSection));
router.put("/sections/reorder", adminAuth, h(c.reorderSections));
router.get("/sections/:id", adminAuth, h(c.getSectionById));
router.put("/sections/:id", adminAuth, h(c.updateSection));
router.delete("/sections/:id", adminAuth, h(c.deleteSection));
router.patch("/sections/:id/toggle", adminAuth, h(c.toggleSection));

module.exports = router;
