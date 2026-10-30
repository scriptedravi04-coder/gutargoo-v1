// Gutargoo Plus backend — serves the mobile app and the admin panel.
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
// Settings: .env file (local) and/or the single GG_ENV secret (deploy) — see server/lib/loadEnv.js
const ggCount = require("./lib/loadEnv").loadEnv();

// A missing setting no longer stops the server: the site opens and /api/health says exactly what is missing.
const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
for (const k of requiredEnv) {
  if (!process.env[k]) console.error(`❌ Missing ${k} — add it to GG_ENV (or .env). See GG_ENV.example.txt`);
}
let dbProblem = process.env.MONGO_URI ? "connecting" : "MONGO_URI is missing — add it to GG_ENV";

const app = express();
// Use the real visitor IP for rate limits. Number of proxies in front of Node:
// Cloud Run direct (or nginx) = 1 (default) · Cloudflare/load balancer also in front = 2 · nothing in front = 0
const trustProxy = parseInt(process.env.TRUST_PROXY, 10);
app.set("trust proxy", Number.isInteger(trustProxy) && trustProxy >= 0 ? trustProxy : 1);
app.disable("x-powered-by");

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Express 5 leaves req.body undefined when no body was sent → make it {} so `req.body.x` never crashes
// (upload routes: multer sets its own body, and lib/upload.js does the same check after it)
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// Database not connected yet → a clear 503 right away (instead of every request hanging 10 s)
// Backup while our database is down: borrow the live app's server (LIVE_API_URL, default admin.gutargooplus.com).
// The Play Store / App Store app runs on it, so movies, OTP login and play links keep working on the website.
// Admin panel calls (/auth, /admin) are never sent there. LIVE_API_URL=off turns this off.
const liveBase = () => {
  const v = String(process.env.LIVE_API_URL ?? "https://admin.gutargooplus.com").trim().replace(/\/+$/, "").replace(/\/api$/, "");
  return !v || /^(off|false|no|0)$/i.test(v) ? "" : v;
};
const LIVE_SKIP = /^\/(health|play-check|auth|admin)(\/|$)/;
const viaLive = async (req, res) => {
  const base = liveBase();
  if (!base || LIVE_SKIP.test(req.path) || req.headers["x-gg-live"]) return false;
  try {
    const headers = { accept: "application/json", "user-agent": "GutargooWeb/1 (backup)", "x-gg-live": "1" };
    const tok = String(req.headers["x-gg-token"] || "").trim();
    if (tok) headers.authorization = `Bearer ${tok}`;
    else if (req.headers.authorization) headers.authorization = req.headers.authorization;
    let body;
    if (!["GET", "HEAD"].includes(req.method)) {
      if (!String(req.headers["content-type"] || "").includes("json")) return false; // only JSON bodies (no uploads)
      headers["content-type"] = "application/json";
      body = JSON.stringify(req.body || {});
    }
    const r = await fetch(`${base}/api${req.url}`, { method: req.method, headers, body, signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    res.status(r.status);
    res.setHeader("content-type", r.headers.get("content-type") || "application/json");
    res.setHeader("x-gg-data", "live-backup");
    res.setHeader("cache-control", "no-store");
    res.send(text);
    return true;
  } catch (e) {
    console.warn(`Live backup failed for ${req.method} ${req.path}: ${e.message}`);
    return false;
  }
};

app.use("/api", async (req, res, next) => {
  if (req.path === "/health" || req.path === "/play-check" || mongoose.connection.readyState === 1) return next();
  if (await viaLive(req, res)) return;
  // first seconds after a start: "starting up"; after a failed try: say what's wrong (same text as /api/health)
  res.status(503).json({ success: false, message: dbProblem && dbProblem !== "connecting" ? `Database not connected: ${dbProblem}` : "Server is starting up. Please try again in a moment." });
});

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
app.use("/api/founder", require("./routes/founderRoutes")); // "Free Premium for the first 1000"
app.use("/api", require("./routes/redeemRoutes")); // /api/redeem…
app.use("/api", require("./routes/downloadRoutes")); // /api/download/:id
app.use("/api", require("./routes/searchRoutes")); // /api/search

// Older public read-only addresses — now point at the same safe code the app uses
app.use("/api/public", require("./routes/publicAliases"));

app.get("/api/health", (req, res) => {
  // "app" lets the website/admin know they're talking to this (new) server and not an old one
  res.json({
    success: true,
    app: "gutargoo-one",
    message: "Server is running",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    ...(mongoose.connection.readyState === 1 ? {} : { dbProblem, dataFrom: liveBase() ? `backup: ${liveBase()} (movies + OTP from the live app server until our database connects)` : "none" }),
    // which settings the server can see (names only, never values) — for checking GG_ENV
    settings: {
      GG_ENV: process.env.GG_ENV ? `${ggCount} settings loaded` : "not set",
      MONGO_URI: !!process.env.MONGO_URI,
      JWT_SECRET: !!process.env.JWT_SECRET,
      BUNNY_VIDEO_API_KEY: !!process.env.BUNNY_VIDEO_API_KEY,
      BUNNY_CDN_HOSTNAME: !!process.env.BUNNY_CDN_HOSTNAME,
      BUNNY_STORAGE_ZONE: !!process.env.BUNNY_STORAGE_ZONE,
      SMS_AUTH_KEY: !!process.env.SMS_AUTH_KEY,
    },
    streamHosts: app.locals.streamHosts ? app.locals.streamHosts() : [],
  });
});

// Admin → Dashboard "Test video playback": can this server fetch a real video playlist from Bunny?
app.get("/api/admin/stream-test", require("./middleware/authMiddleware").adminAuth, async (req, res) => {
  const Movie = require("./models/Movie");
  // newest few ready movies: one broken upload shouldn't make the whole test say "not working"
  const movies = await Movie.find({ "movieFile.videoId": { $nin: [null, ""] }, "movieFile.status": 4 }, "movieTitle movieFile.videoId").sort({ updatedAt: -1 }).limit(5).lean();
  if (!movies.length) return res.json({ success: true, data: { ok: false, step: "no-movie", message: "No ready movie with a Bunny video found" } });
  const upstream = upstreamFor("stream", { headers: { host: req.headers.host } });
  if (!upstream) return res.json({ success: true, data: { ok: false, step: "config", message: "BUNNY_CDN_HOSTNAME is not set" } });
  const referer = process.env.BUNNY_REFERER || refererFor("stream");
  const failed = [];
  let last = null;
  for (const m of movies) {
    const id = m.movieFile.videoId;
    const out = { title: m.movieTitle, videoId: id, upstream };
    try {
      const r = await fetch(`${upstream}/${id}/playlist.m3u8`, {
        headers: { "accept-encoding": "identity", "user-agent": "Mozilla/5.0 (GutargooServer)", ...(referer ? { referer } : {}) },
        signal: AbortSignal.timeout(10000),
      });
      const text = (await r.text()).slice(0, 200);
      if (r.ok && text.includes("#EXTM3U")) {
        const note = failed.length ? ` (but these did not: ${failed.join(", ")} — re-upload their video)` : "";
        return res.json({ success: true, data: { ...out, ok: true, status: r.status, message: `Video playback works through this server${note}` } });
      }
      failed.push(m.movieTitle);
      last = { ...out, ok: false, status: r.status, sample: text, message: `Bunny answered ${r.status}${r.status === 403 ? " — check Bunny Stream → Security (allowed referrers / token authentication)" : r.status === 404 ? " — the video is missing in Bunny, or BUNNY_CDN_HOSTNAME is the wrong library" : ""}` };
      if (r.status === 403) break; // a settings problem — the same for every video
    } catch (e) {
      return res.json({ success: true, data: { ...out, ok: false, step: "fetch", message: `Could not reach ${upstream}: ${e.message}` } });
    }
  }
  if (failed.length > 1 && last) last.message += ` (checked: ${failed.join(", ")})`;
  res.json({ success: true, data: last });
});

// Player failed → why? Checks this video on Bunny from the server and answers in plain words.
// Only a Bunny video id is accepted (never a free URL), results are cached for a minute.
const playCheckCache = new Map();
app.get("/api/play-check", async (req, res) => {
  const id = String(req.query.id || "").toLowerCase();
  if (!/^[0-9a-f-]{20,40}$/.test(id)) return res.json({ success: true, data: { ok: null, reason: "" } });
  const hit = playCheckCache.get(id);
  if (hit && Date.now() - hit.at < 60000) return res.json({ success: true, data: hit.data });
  const done = (data) => {
    playCheckCache.set(id, { at: Date.now(), data });
    if (playCheckCache.size > 500) playCheckCache.delete(playCheckCache.keys().next().value);
    res.json({ success: true, data });
  };
  // 1) Bunny's own status for this video (needs BUNNY_VIDEO_API_KEY + BUNNY_LIBRARY_ID)
  const key = process.env.BUNNY_VIDEO_API_KEY, lib = process.env.BUNNY_LIBRARY_ID;
  if (key && lib) {
    try {
      const r = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(String(lib).trim())}/videos/${id}`, { headers: { AccessKey: String(key).trim(), accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) return done({ ok: false, code: "deleted", reason: "This video is not in Bunny any more (deleted, or uploaded to another library). Upload it again from Admin." });
      if (r.ok) {
        const v = await r.json().catch(() => ({}));
        const st = Number(v.status);
        if (st === 0) return done({ ok: false, code: "uploading", reason: "The video is still uploading to Bunny. Try again in a few minutes." });
        if (st >= 1 && st <= 3) return done({ ok: false, code: "processing", reason: `The video is still being processed on Bunny${v.encodeProgress ? ` (${v.encodeProgress}%)` : ""}. Try again in a few minutes.` });
        if (st === 5) return done({ ok: false, code: "encode-failed", reason: "Bunny couldn't process this video file (bad or unsupported file). Re-upload it from Admin." });
        if (st === 6) return done({ ok: false, code: "upload-failed", reason: "The upload to Bunny failed halfway. Re-upload the video from Admin." });
      }
    } catch {
      /* Bunny API unreachable → still try the playlist below */
    }
  }
  // 2) can this server fetch the playlist the way the website does?
  const upstream = upstreamFor("stream", { headers: { host: req.headers.host } });
  if (!upstream) return done({ ok: false, code: "config", reason: "Video server is not set up: BUNNY_CDN_HOSTNAME is missing in GG_ENV." });
  const referer = process.env.BUNNY_REFERER || refererFor("stream");
  try {
    const r = await fetch(`${upstream}/${id}/playlist.m3u8`, { headers: { "accept-encoding": "identity", "user-agent": "Mozilla/5.0 (GutargooServer)", ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(10000) });
    const text = await r.text().catch(() => "");
    if (r.status === 403 || r.status === 401) return done({ ok: false, code: "blocked", reason: "Bunny is blocking playback (403). Check Bunny Stream → Security: allowed referrers / token authentication." });
    if (r.status === 404) return done({ ok: false, code: "missing", reason: "Video file not found on Bunny (404) — deleted, or BUNNY_CDN_HOSTNAME points to the wrong library." });
    if (r.status >= 500) return done({ ok: false, code: "bunny-down", reason: `Bunny's server had a problem (${r.status}). Try again in a little while.` });
    if (!r.ok || !text.includes("#EXTM3U")) return done({ ok: false, code: "bad-playlist", reason: `Bunny sent something that isn't a video playlist (${r.status}). The upload may be broken — re-upload it.` });
    // first quality's playlist must exist too
    const variant = text.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
    if (variant && !/^https?:/i.test(variant)) {
      const v = await fetch(`${upstream}/${id}/${variant}`, { headers: { "user-agent": "Mozilla/5.0 (GutargooServer)", ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (v && !v.ok) return done({ ok: false, code: "variant", reason: `The video's ${variant.split("/")[0]} quality is missing on Bunny (${v.status}). Re-upload or re-encode it.` });
    }
    return done({ ok: true, code: "ok", reason: "" });
  } catch (e) {
    return done({ ok: false, code: "unreachable", reason: `Our server can't reach Bunny right now (${e.name === "TimeoutError" ? "timeout" : "network error"}).` });
  }
});

app.use("/api", (req, res) => res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` }));

// ── Videos / images through this server (/stream/..., /storage/...) ──────
// The website plays videos from its own address, so browsers never block them (CORS) and
// networks that block *.b-cdn.net still work. On the old server nginx does this; here Node does it.
//   /stream  → BUNNY_CDN_HOSTNAME (e.g. vz-xxxx.b-cdn.net), else BUNNY_STREAM_PUBLIC_BASE if that's another server
//   /storage → BUNNY_STORAGE_CDN_HOSTNAME or <BUNNY_STORAGE_ZONE>.b-cdn.net, else BUNNY_STORAGE_PUBLIC_BASE if another server
const { Readable, pipeline } = require("stream");
const hostOnly = (v) => String(v || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const upstreamFor = (kind, req) => {
  const cdn =
    kind === "stream"
      ? hostOnly(process.env.BUNNY_CDN_HOSTNAME)
      : hostOnly(process.env.BUNNY_STORAGE_CDN_HOSTNAME) || (process.env.BUNNY_STORAGE_ZONE ? `${process.env.BUNNY_STORAGE_ZONE.trim()}.b-cdn.net` : "");
  if (cdn) return `https://${cdn}`;
  const base = String(process.env[kind === "stream" ? "BUNNY_STREAM_PUBLIC_BASE" : "BUNNY_STORAGE_PUBLIC_BASE"] || "").trim().replace(/\/+$/, "");
  try {
    if (base && new URL(base).host !== req.headers.host) return base;
  } catch {
    /* bad url */
  }
  return "";
};
/** Hosts whose links the website may play through /stream (told to the website by /api/health) */
const streamHosts = () => {
  const out = new Set();
  const cdn = hostOnly(process.env.BUNNY_CDN_HOSTNAME);
  if (cdn) out.add(cdn.toLowerCase());
  try {
    if (process.env.BUNNY_STREAM_PUBLIC_BASE) out.add(new URL(process.env.BUNNY_STREAM_PUBLIC_BASE.trim()).host.toLowerCase());
  } catch {
    /* ignore */
  }
  return [...out];
};
app.locals.streamHosts = streamHosts;

const refererFor = (kind) => {
  try {
    const base = process.env[kind === "stream" ? "BUNNY_STREAM_PUBLIC_BASE" : "BUNNY_STORAGE_PUBLIC_BASE"];
    return base ? `${new URL(base).origin}/` : "";
  } catch {
    return "";
  }
};
const proxy = (kind) => async (req, res) => {
  const rest = req.params[0];
  if (!/^[A-Za-z0-9_\-./]+$/.test(rest) || rest.includes("..")) return res.status(400).end();
  if (req.headers["x-gg-proxy"]) return res.status(508).end(); // never proxy to ourselves
  const upstream = upstreamFor(kind, req);
  if (!upstream) return res.status(503).json({ success: false, message: kind === "stream" ? "Set BUNNY_CDN_HOSTNAME to play videos" : "Set BUNNY_STORAGE_ZONE to show images" });
  const ctrl = new AbortController();
  res.on("close", () => !res.writableFinished && ctrl.abort());
  try {
    const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    const headers = { "accept-encoding": "identity", "x-gg-proxy": "1", "user-agent": "Mozilla/5.0 (GutargooServer)" };
    // Bunny "allowed referrers" protection: present the site's own address (or BUNNY_REFERER)
    const referer = process.env.BUNNY_REFERER || refererFor(kind);
    if (referer) headers.referer = referer;
    if (req.headers.range) headers.range = req.headers.range;
    const r = await fetch(`${upstream}/${rest}${qs}`, { method: req.method === "HEAD" ? "HEAD" : "GET", headers, signal: ctrl.signal });
    res.status(r.status);
    const encoded = !!r.headers.get("content-encoding");
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      if (h === "content-length" && encoded) continue;
      const v = r.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (r.ok) res.setHeader("Cache-Control", rest.endsWith(".m3u8") ? "public, max-age=30" : "public, max-age=86400");
    else res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // never let the browser guess file types; uploaded files can't run scripts on our domain
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (kind === "storage") res.setHeader("Content-Security-Policy", "sandbox");
    if (!r.body || req.method === "HEAD") return res.end();
    // pipeline: an upstream/visitor error ends both sides quietly (never an uncaught crash)
    pipeline(Readable.fromWeb(r.body), res, (err) => {
      if (err && !res.destroyed) res.destroy();
    });
  } catch {
    if (!res.headersSent) res.status(502).end();
    else res.end();
  }
};
app.get(/^\/stream\/(.+)$/, proxy("stream"));
app.get(/^\/storage\/(.+)$/, proxy("storage"));

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
  // store links come from GG_ENV at runtime (no rebuild needed to change them)
  const pub = {
    playStoreUrl: (process.env.PLAY_STORE_URL || process.env.VITE_PLAY_STORE_URL || "").trim(),
    appStoreUrl: (process.env.APP_STORE_URL || process.env.VITE_APP_STORE_URL || "").trim(),
  };
  // read once, again only if a new build replaced the file
  let indexCache = { mtime: 0, html: "" };
  const indexHtml = () => {
    const file = path.join(DIST, "index.html");
    const mtime = fs.statSync(file).mtimeMs;
    if (mtime !== indexCache.mtime) {
      const html = fs.readFileSync(file, "utf8").replace("</head>", `<script>window.__GG=${JSON.stringify(pub).replace(/</g, "\\u003c")}</script></head>`);
      indexCache = { mtime, html };
    }
    return indexCache.html;
  };
  app.get(/^\/(?!api\/|stream\/|storage\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(indexHtml());
  });
} else {
  console.warn("⚠️  No dist/ folder — run `npm run build` to serve the website and admin panel from this server.");
}
app.use(require("./middleware/errorHandler"));

// A stray rejected promise: log it and keep running.
process.on("unhandledRejection", (err) => console.error("❌ Unhandled promise error:", err));
// A real crash leaves the server in an unknown state: log it and exit — Cloud Run starts a fresh instance.
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught error (restarting):", err);
  process.exit(1);
});

// ── First admin without a terminal (Google AI Studio / Cloud Run) ─────────
// Set ADMIN_EMAIL + ADMIN_PASSWORD (8+ chars) as secrets, restart once, log in at /admin,
// then REMOVE both secrets. Creates that admin only if the email doesn't exist yet.
// Forgot the password? Also set ADMIN_RESET_PASSWORD=yes for one restart — that resets
// the existing admin's password (and logs out its old sessions). Remove all three afterwards.
async function ensureBootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email && !password) return;
  if (!email || password.length < 8) return console.warn("⚠️  ADMIN_EMAIL / ADMIN_PASSWORD set but invalid (password needs 8+ characters) — skipped");
  try {
    const bcrypt = require("bcryptjs");
    const User = require("./models/User");
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await User.findOne({ email: { $regex: `^${escaped}$`, $options: "i" } });
    if (!existing) {
      await User.create({ name: "Admin", email, password: await bcrypt.hash(password, 10), role: "admin" });
      console.log(`✅ Admin created: ${email} — now remove ADMIN_EMAIL / ADMIN_PASSWORD from the settings`);
    } else if ((process.env.ADMIN_RESET_PASSWORD || "").trim().toLowerCase() === "yes") {
      // already this password (e.g. every Cloud Run cold start while the setting is still there) →
      // do nothing, so admins aren't logged out again and again
      if (existing.role === "admin" && existing.password && (await bcrypt.compare(password, existing.password))) {
        return console.log(`ℹ️  Admin ${existing.email} already has this password — nothing reset. REMOVE ADMIN_RESET_PASSWORD, ADMIN_EMAIL and ADMIN_PASSWORD from the settings.`);
      }
      existing.password = await bcrypt.hash(password, 10);
      existing.role = "admin";
      existing.passwordChangedAt = new Date();
      await existing.save();
      console.log(`✅ Admin password reset: ${email} — REMOVE ADMIN_RESET_PASSWORD, ADMIN_EMAIL and ADMIN_PASSWORD from the settings now`);
    } else {
      console.log(`ℹ️  Admin ${email} already exists — password NOT changed (set ADMIN_RESET_PASSWORD=yes to reset). Remove ADMIN_EMAIL / ADMIN_PASSWORD.`);
    }
  } catch (e) {
    console.error("❌ Could not create the admin:", e.message);
  }
}

// ── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// the website starts right away; the database connects in the background and keeps retrying
app.listen(PORT, "0.0.0.0", () => console.log(`🔥 Server running on port ${PORT}`));

const explainDbError = (err) => {
  const m = String(err?.message || err || "");
  if (/bad auth|authentication failed|auth failed/i.test(m)) return "MongoDB rejected the username/password in MONGO_URI";
  if (/ENOTFOUND|EBADNAME|ENODATA/i.test(m))
    return "The cluster address in MONGO_URI does not exist (DNS lookup failed) — the Atlas cluster was deleted/renamed, or the link was copied wrong. In Atlas → Database → Connect → Drivers, copy a fresh connection string into MONGO_URI";
  if (/whitelist|IP address|Server selection timed out|ReplicaSetNoPrimary|ECONNREFUSED|ETIMEDOUT|querySrv/i.test(m))
    return "Can't reach MongoDB — in MongoDB Atlas → Network Access, allow 0.0.0.0/0 (Cloud Run has no fixed IP); or the cluster address in MONGO_URI is wrong";
  if (/Invalid scheme|URI|mongodb\+srv|Invalid connection string/i.test(m)) return "MONGO_URI is not a valid MongoDB link";
  return "MongoDB connection failed (see server logs)";
};
let started = false;
async function connectDb(attempt = 1) {
  if (!process.env.MONGO_URI) return;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    dbProblem = "";
    console.log("✅ MongoDB connected");
    if (!started) {
      started = true;
      require("./services/videoStatusSync").start();
      ensureBootstrapAdmin();
    }
  } catch (err) {
    dbProblem = explainDbError(err);
    // log loudly once (and every 10th try), quietly otherwise — no error flood in the hosting logs
    if (attempt === 1 || attempt % 10 === 0) console.error(`❌ MongoDB connection failed (try ${attempt}): ${dbProblem}\n   ${err.message}`);
    else console.warn(`MongoDB still not connected (try ${attempt}), retrying…`);
    setTimeout(() => connectDb(attempt + 1), Math.min(60000, 5000 * attempt));
  }
}
connectDb();

module.exports = app;
