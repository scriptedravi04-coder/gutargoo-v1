// Admin-only: app users, dashboard numbers, Bunny upload sessions.
const Customer = require("../models/Customer");
const Movie = require("../models/Movie");
const WebSeries = require("../models/webseries");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");
const RedeemCode = require("../models/RedeemCode");
const ContinueWatching = require("../models/ContinueWatching");
const bunny = require("../services/bunnyService");
const { syncVideo } = require("../services/videoStatusSync");
const { videoInUse } = require("../lib/media");
const { HttpError, isId, parseBool, parseNum, parseStr, escapeRegex, paging } = require("../lib/http");

/* ───────── App users ───────── */

const formatCustomer = (c) => {
  const o = c.toObject ? c.toObject() : c;
  const subActive = !!(o.subscriptionExpiry && new Date(o.subscriptionExpiry) > new Date());
  return { ...o, isPremium: !!o.isPremiusm || subActive, subscriptionActive: subActive };
};

// GET /api/admin/customers?page=&limit=&search=&filter=premium|blocked
exports.listCustomers = async (req, res) => {
  const { page, limit, skip } = paging(req.query, 50);
  const q = {};
  // "+91 98765-43210" / "098765 43210" → "9876543210"
  let digits = String(req.query.search || "").replace(/\D/g, "");
  if (digits.length > 10) digits = digits.replace(/^(91|0)/, "");
  if (digits) q.mobile = { $regex: escapeRegex(digits) };
  if (req.query.filter === "premium") q.$or = [{ isPremiusm: true }, { subscriptionExpiry: { $gt: new Date() } }];
  if (req.query.filter === "blocked") q.isBlocked = true;
  const [data, total] = await Promise.all([
    Customer.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(q),
  ]);
  res.json({
    success: true,
    message: "Users fetched",
    data: data.map(formatCustomer),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
};

// PATCH /api/admin/customers/:id  { name, isBlocked, isPremium, coins, addSubscriptionDays, subscriptionExpiry }
exports.updateCustomer = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const c = await Customer.findById(req.params.id);
  if (!c) throw new HttpError(404, "User not found");
  const b = req.body || {};
  if (b.name !== undefined) c.name = parseStr(b.name);
  if (b.isBlocked !== undefined) c.isBlocked = parseBool(b.isBlocked, false);
  if (b.isPremium !== undefined) c.isPremiusm = parseBool(b.isPremium, false);
  if (b.coins !== undefined) c.coins = Math.max(0, parseNum(b.coins, 0));
  const addDays = parseNum(b.addSubscriptionDays, 0);
  if (addDays) {
    const start = c.subscriptionExpiry && c.subscriptionExpiry > new Date() ? c.subscriptionExpiry : new Date();
    c.subscriptionExpiry = new Date(start.getTime() + addDays * 24 * 60 * 60 * 1000);
    c.subscriptionDays = (c.subscriptionDays || 0) + addDays;
  }
  if (b.subscriptionExpiry === null || b.subscriptionExpiry === "") c.subscriptionExpiry = null;
  await c.save();
  res.json({ success: true, message: "User updated", data: formatCustomer(c) });
};

/* ───────── Dashboard ───────── */

exports.stats = async (req, res) => {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  // "today" = today in India (+05:30), whatever timezone the server runs in
  const IST = 5.5 * 60 * 60 * 1000;
  const startToday = new Date(Math.floor((now.getTime() + IST) / day) * day - IST);
  const since14 = new Date(startToday.getTime() - 13 * day);

  const [
    users, usersToday, users7, premium, blocked,
    movies, moviesPublished, moviesProcessing, series, banners, sections, activeCodes,
    viewsAgg, topMovies, recentMovies, signupsAgg, watchingNow,
  ] = await Promise.all([
    Customer.countDocuments(),
    Customer.countDocuments({ createdAt: { $gte: startToday } }),
    Customer.countDocuments({ createdAt: { $gte: new Date(now - 7 * day) } }),
    Customer.countDocuments({ $or: [{ isPremiusm: true }, { subscriptionExpiry: { $gt: now } }] }),
    Customer.countDocuments({ isBlocked: true }),
    Movie.countDocuments(),
    Movie.countDocuments({ publishStatus: true }),
    Movie.countDocuments({ "movieFile.videoId": { $nin: [null, ""] }, "movieFile.status": { $nin: [4, 5, 6] } }),
    // old series have no contentType (= web series); count episodes from the real list, not the saved total
    WebSeries.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$contentType", "webseries"] },
          count: { $sum: 1 },
          episodes: {
            $sum: {
              $sum: {
                $map: {
                  input: { $cond: [{ $isArray: "$seasons" }, "$seasons", []] },
                  as: "s",
                  in: { $cond: [{ $isArray: "$$s.episodes" }, { $size: "$$s.episodes" }, 0] },
                },
              },
            },
          },
        },
      },
    ]),
    Banner.countDocuments({ publishStatus: true }),
    HomeSection.countDocuments({ isActive: true }),
    RedeemCode.countDocuments({ isActive: true, expiryDate: { $gt: now } }),
    Movie.aggregate([{ $group: { _id: null, views: { $sum: "$viewCount" } } }]),
    Movie.find({}, "movieTitle viewCount verticalPoster").sort({ viewCount: -1 }).limit(5).lean(),
    Movie.find({}, "movieTitle createdAt publishStatus verticalPoster movieFile.status movieFile.videoId").sort({ createdAt: -1 }).limit(5).lean(),
    Customer.aggregate([
      { $match: { createdAt: { $gte: since14 } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, count: { $sum: 1 } } },
    ]),
    ContinueWatching.countDocuments({ updatedAt: { $gte: new Date(now - day) } }),
  ]);

  const signupsByDay = new Map(signupsAgg.map((r) => [r._id, r.count]));
  const signups = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * day + IST).toISOString().slice(0, 10);
    signups.push({ date: d, count: signupsByDay.get(d) || 0 });
  }
  // anything that isn't "tvshow" counts as a web series (same rule as the app lists)
  const seriesBy = { webseries: { count: 0, episodes: 0 }, tvshow: { count: 0, episodes: 0 } };
  for (const g of series) {
    const k = g._id === "tvshow" ? "tvshow" : "webseries";
    seriesBy[k].count += g.count || 0;
    seriesBy[k].episodes += g.episodes || 0;
  }

  res.json({
    success: true,
    data: {
      users: { total: users, today: usersToday, last7Days: users7, premium, blocked },
      content: {
        movies,
        moviesPublished,
        moviesProcessing,
        webSeries: seriesBy.webseries?.count || 0,
        tvShows: seriesBy.tvshow?.count || 0,
        episodes: (seriesBy.webseries?.episodes || 0) + (seriesBy.tvshow?.episodes || 0),
        banners,
        sections,
      },
      activeRedeemCodes: activeCodes,
      totalViews: viewsAgg[0]?.views || 0,
      watchedLast24h: watchingNow,
      topMovies: topMovies.map((m) => ({ _id: m._id, title: m.movieTitle, views: m.viewCount || 0, posterUrl: m.verticalPoster?.url || "" })),
      recentMovies: recentMovies.map((m) => ({
        _id: m._id,
        title: m.movieTitle,
        createdAt: m.createdAt,
        publishStatus: m.publishStatus,
        // link-only / no-video movies have no Bunny video → no status (not "Processing")
        videoStatus: m.movieFile?.videoId ? m.movieFile.status ?? null : null,
        posterUrl: m.verticalPoster?.url || "",
      })),
      signups,
    },
  });
};

/* ───────── Bunny (video upload straight from the admin panel) ───────── */

// POST /api/admin/bunny/upload-session { title } → { videoId, libraryId, expires, signature, endpoint }
exports.createUploadSession = async (req, res) => {
  const title = parseStr(req.body.title) || "Untitled";
  try {
    const session = await bunny.createUploadSession(title);
    res.json({ success: true, data: session });
  } catch (err) {
    console.error("Bunny upload session failed:", err.response?.data || err.message);
    throw new HttpError(502, "Could not start the upload on Bunny. Check BUNNY_VIDEO_API_KEY / BUNNY_LIBRARY_ID.");
  }
};

// DELETE /api/admin/bunny/videos/:videoId → removes an uploaded-but-never-saved video.
// Only deletes when no movie, trailer or episode uses it, so a saved video can never be removed here.
exports.deleteUnusedVideo = async (req, res) => {
  const videoId = parseStr(req.params.videoId);
  if (!videoId || !/^[a-zA-Z0-9-]{8,64}$/.test(videoId)) throw new HttpError(400, "Invalid video id");
  if (await videoInUse(videoId)) return res.json({ success: true, deleted: false, message: "Video is in use, kept" });
  await bunny.deleteVideo(videoId);
  res.json({ success: true, deleted: true, message: "Video deleted" });
};

// GET /api/admin/bunny/videos/:videoId → current status; also updates any movie/episode using it
exports.videoStatus = async (req, res) => {
  const videoId = parseStr(req.params.videoId);
  const info = await syncVideo(videoId);
  if (!info) throw new HttpError(404, "Video not found on Bunny");
  res.json({
    success: true,
    data: {
      videoId,
      status: info.status,
      ready: info.status === bunny.STATUS.READY,
      failed: info.status === bunny.STATUS.ERROR || info.status === bunny.STATUS.UPLOAD_FAILED,
      encodeProgress: info.encodeProgress ?? null,
      length: info.length || 0,
      ...bunny.streamUrls(videoId),
    },
  });
};
