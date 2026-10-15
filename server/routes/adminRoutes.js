const router = require("express").Router();
const c = require("../controllers/adminController");
const { adminAuth } = require("../middleware/authMiddleware");
const { asyncHandler: h } = require("../lib/http");

router.use(adminAuth);

router.get("/stats", h(c.stats));
router.get("/customers", h(c.listCustomers));
router.patch("/customers/:id", h(c.updateCustomer));
router.post("/bunny/upload-session", h(c.createUploadSession));
router.get("/bunny/videos/:videoId", h(c.videoStatus));

module.exports = router;
