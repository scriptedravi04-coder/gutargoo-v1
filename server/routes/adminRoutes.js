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
router.delete("/bunny/videos/:videoId", h(c.deleteUnusedVideo));

// "System check" card on the dashboard: which settings are filled in (never the values themselves)
router.get("/system", (req, res) => {
  const has = (k) => !!(process.env[k] && String(process.env[k]).trim());
  const mongoose = require("mongoose");
  res.json({
    success: true,
    data: {
      app: "gutargoo-one",
      db: mongoose.connection.readyState === 1,
      checks: [
        { key: "MONGO_URI", ok: has("MONGO_URI"), label: "Database (MongoDB)", need: "required" },
        { key: "JWT_SECRET", ok: has("JWT_SECRET"), label: "Login secret", need: "required" },
        { key: "BUNNY_VIDEO_API_KEY", ok: has("BUNNY_VIDEO_API_KEY") && has("BUNNY_LIBRARY_ID"), label: "Video upload (Bunny Stream key + library id)", need: "required" },
        { key: "BUNNY_CDN_HOSTNAME", ok: has("BUNNY_CDN_HOSTNAME"), label: "Video playback on the website (Bunny Stream CDN hostname, e.g. vz-xxxx.b-cdn.net)", need: "required" },
        { key: "BUNNY_STORAGE_ZONE", ok: has("BUNNY_STORAGE_ZONE") && has("BUNNY_STORAGE_PASSWORD"), label: "Image upload (Bunny Storage zone + password)", need: "required" },
        { key: "BUNNY_STORAGE_PUBLIC_BASE", ok: has("BUNNY_STORAGE_PUBLIC_BASE") || has("BUNNY_STORAGE_ZONE"), label: "Image address", need: "required" },
        { key: "SMS_AUTH_KEY", ok: has("SMS_AUTH_KEY") && has("SMS_USER"), label: "OTP SMS", need: "for app login" },
        { key: "ADMIN_PASSWORD", ok: !has("ADMIN_PASSWORD"), label: "ADMIN_EMAIL / ADMIN_PASSWORD removed after first login", need: "safety" },
      ],
      streamBase: process.env.BUNNY_STREAM_PUBLIC_BASE || "",
      storageBase: process.env.BUNNY_STORAGE_PUBLIC_BASE || "",
    },
  });
});

module.exports = router;
