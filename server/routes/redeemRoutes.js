const router = require("express").Router();
const c = require("../controllers/redeemController");
const { auth, adminAuth } = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");
const { asyncHandler: h } = require("../lib/http");

// 10 tries per user per 10 minutes, so codes can't be guessed
const redeemLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, key: (req) => `redeem:${req.user?._id || req.ip}` });

// Admin
router.post("/redeem/admin/create", adminAuth, h(c.createRedeemCode));
router.get("/redeem/admin/all", adminAuth, h(c.getAllCodes));
router.put("/redeem/admin/:id", adminAuth, h(c.updateRedeemCode));
router.delete("/redeem/admin/:id", adminAuth, h(c.deleteCode));

// App (logged-in users)
router.get("/redeem/list", auth, h(c.getAvailableCodes));
router.post("/redeem", auth, redeemLimit, h(c.redeemCode));

module.exports = router;
