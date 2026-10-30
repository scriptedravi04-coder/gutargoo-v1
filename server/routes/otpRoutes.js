const router = require("express").Router();
const c = require("../controllers/otpController");
const admin = require("../controllers/adminController");
const { adminAuth } = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");
const { ipKey } = rateLimit;
const { asyncHandler: h } = require("../lib/http");

// Max 5 OTP SMS per number per 15 min (stops SMS-bill abuse on one number).
// Per-IP limits are shared by every server instance now, and many phones share one mobile-network
// IP (CGNAT), so they are generous: 200 sends / 300 verifies per IP (IPv6: per /64) per 15 min.
// A number we can't read skips the per-number limit → the controller replies "valid 10-digit number".
const perMobile = rateLimit({
  name: "otp-m",
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: (req) => !c.normalizeMobile(req.body?.mobile),
  key: (req) => `otp-m:${c.normalizeMobile(req.body?.mobile)}`,
  message: "Too many OTP requests for this number. Please wait 15 minutes.",
});
const perIp = rateLimit({ name: "otp-ip", windowMs: 15 * 60 * 1000, max: 200, key: (req) => `otp-ip:${ipKey(req)}` });
const verifyLimit = rateLimit({ name: "otp-v", windowMs: 15 * 60 * 1000, max: 300, key: (req) => `otp-v:${ipKey(req)}` });

router.post("/send", perIp, perMobile, h(c.sendOtp));
router.post("/verify", verifyLimit, h(c.verifyOtp));

// old admin users list — now admin-only (same data as /api/admin/customers)
router.get("/getUsers", adminAuth, h(admin.listCustomers));

module.exports = router;
