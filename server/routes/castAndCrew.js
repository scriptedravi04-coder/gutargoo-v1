const router = require("express").Router();
const c = require("../controllers/castCrewController");
const { adminAuth } = require("../middleware/authMiddleware");
const upload = require("../lib/upload");
const { asyncHandler: h } = require("../lib/http");

const photo = upload.images(["profileImage"]);

router.get("/getAll", adminAuth, h(c.all));
router.get("/", adminAuth, h(c.list));
router.get("/:id", adminAuth, h(c.getById));
router.post("/", adminAuth, photo, h(c.create));
router.put("/:id", adminAuth, photo, h(c.update));
router.delete("/:id", adminAuth, h(c.remove));

module.exports = router;
