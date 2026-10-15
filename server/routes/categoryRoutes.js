const router = require("express").Router();
const c = require("../controllers/categoryController");
const { adminAuth } = require("../middleware/authMiddleware");
const { asyncHandler: h } = require("../lib/http");

router.get("/", h(c.getCategories)); // app + admin
router.post("/", adminAuth, h(c.createCategory));
router.put("/:id", adminAuth, h(c.updateCategory));
router.delete("/:id", adminAuth, h(c.deleteCategory));

module.exports = router;
