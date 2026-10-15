const router = require("express").Router();
const c = require("../controllers/otpController");
const admin = require("../controllers/adminController");
const { adminAuth } = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");
const { asyncHandler: h } = require("../lib/http");

// Max 5 OTP SMS per number per 15 min, and 20 per device/IP per 15 min (stops SMS-bill abuse)
const perMobile = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  key: (req) => `otp-m:${c.normalizeMobile(req.body?.mobile) || "bad"}`,
  message: "Too many OTP requests for this number. Please wait 15 minutes.",
});
const perIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: (req) => `otp-ip:${req.ip}` });
const verifyLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, key: (req) => `otp-v:${req.ip}` });

router.post("/send", perIp, perMobile, h(c.sendOtp));
router.post("/verify", verifyLimit, h(c.verifyOtp));

// old admin users list — now admin-only (same data as /api/admin/customers)
router.get("/getUsers", adminAuth, h(admin.listCustomers));

module.exports = router;
