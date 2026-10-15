// Gutargoo Plus backend — serves the mobile app and the admin panel.
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
// .env lives in the project root (one file for website + server)
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
for (const k of requiredEnv) {
  if (!process.env[k]) {
    console.error(`❌ Missing ${k} in .env — see .env.example`);
    process.exit(1);
  }
}

const app = express();
// behind nginx: use the real visitor IP for rate limits (set TRUST_PROXY=2 if Cloudflare is also in front)
app.set("trust proxy", parseInt(process.env.TRUST_PROXY, 10) || 1);
app.disable("x-powered-by");

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Routes ───────────────────────────────────────────────────────────────
const extras = require("./routes/contentExtrasRoutes");

app.use("/api/auth", require("./routes/auth")); // admin login
app.use("/api/admin", require("./routes/homeSectionRoutes")); // /api/admin/sections…
app.use("/api/admin", require("./routes/adminRoutes")); // stats, customers, bunny upload
app.use("/api/movies", require("./routes/movieRoutes"));
app.use("/api/webseries", require("./routes/webseriesRoutes"));
app.use("/api/category", require("./routes/categoryRoutes"));
app.use("/api/banners", require("./routes/bannerRoutes"));
app.use("/api/castAndCrew", require("./routes/castAndCrew"));
app.use("/api/otp", require("./routes/otpRoutes")); // app login
app.use("/api/customer", require("./routes/CustomerRoutes"));
app.use("/api/movie-likes", require("./routes/movieLikeRoutes"));
app.use("/api/continue-watching", require("./routes/continueWatchingRoutes"));
app.use("/api/ads", extras.ads);
app.use("/api/popups", extras.popups);
app.use("/api/plans", extras.plans);
app.use("/api/vendors", extras.vendors);
app.use("/api/settings", extras.settings);
app.use("/api/bunny", require("./routes/bunnyWebhook"));
app.use("/api", require("./routes/redeemRoutes")); // /api/redeem…
app.use("/api", require("./routes/downloadRoutes")); // /api/download/:id
app.use("/api", require("./routes/searchRoutes")); // /api/search

// Older public read-only addresses — now point at the same safe code the app uses
app.use("/api/public", require("./routes/publicAliases"));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.use("/api", (req, res) => res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` }));

// ── Website + admin panel (the built React app in /dist) ──────────────────
// /admin/* and every other page are handled by the React app (index.html).
const fs = require("fs");
const path = require("path");
const DIST = path.join(__dirname, "..", "dist");
if (fs.existsSync(path.join(DIST, "index.html"))) {
  // hashed files (assets/*) can be cached for a long time; index.html never
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        // phones must always get the newest service worker + manifest
        else if (/(?:^|[\\/])(sw\.js|manifest\.json)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  // a missing build file must be a real 404 — never index.html (that would blank an app left open during a deploy)
  app.use(["/assets", "/img"], (req, res) => res.status(404).end());
  app.get(/^\/(?!api\/|stream\/|storage\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(DIST, "index.html"));
  });
} else {
  console.warn("⚠️  No dist/ folder — run `npm run build` to serve the website and admin panel from this server.");
}
app.use(require("./middleware/errorHandler"));

// Never let one stray error take the whole server down — log it and keep running
process.on("unhandledRejection", (err) => console.error("❌ Unhandled promise error:", err));
process.on("uncaughtException", (err) => console.error("❌ Uncaught error:", err));

// ── First admin without a terminal (Google AI Studio / Cloud Run) ─────────
// Set ADMIN_EMAIL + ADMIN_PASSWORD (8+ chars) as secrets, restart once, log in at /admin,
// then REMOVE both secrets. Creates that admin, or resets its password if it already exists.
async function ensureBootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email && !password) return;
  if (!email || password.length < 8) return console.warn("⚠️  ADMIN_EMAIL / ADMIN_PASSWORD set but invalid (password needs 8+ characters) — skipped");
  try {
    const bcrypt = require("bcryptjs");
    const User = require("./models/User");
    await User.findOneAndUpdate(
      { email },
      { $set: { password: await bcrypt.hash(password, 10), role: "admin" }, $setOnInsert: { name: "Admin" } },
      { upsert: true }
    );
    console.log(`✅ Admin ready: ${email} — now remove ADMIN_EMAIL / ADMIN_PASSWORD from the settings`);
  } catch (e) {
    console.error("❌ Could not create the admin:", e.message);
  }
}

// ── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    require("./services/videoStatusSync").start();
    ensureBootstrapAdmin();
    app.listen(PORT, "0.0.0.0", () => console.log(`🔥 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;
