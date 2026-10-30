// Hero banners at the top of the app's home screen.
const Banner = require("../models/Banner");
const Movie = require("../models/Movie");
const bunny = require("../services/bunnyService");
const { formatWebSeries } = require("../lib/format");
const { uploadImageFile, firstFile } = require("../lib/media");
const { HttpError, isId, parseBool, parseNum, parseStr } = require("../lib/http");
const { isMovieVisible } = require("../lib/visibility");

const populate = (q) =>
  q
    .populate("categoryId", "name categoryType")
    .populate("movieId", "movieTitle verticalPoster horizontalBanner releaseYear genres lang imdbRating ageRating description publishStatus publishDate expiryDate")
    .populate("webseriesId");

// true when the movie / series the banner opens can be watched in the app right now
const linkedIsLive = (b) =>
  b.webseriesId && typeof b.webseriesId === "object"
    ? b.webseriesId.isPublished !== false
    : b.movieId && typeof b.movieId === "object"
    ? isMovieVisible(b.movieId)
    : false;

// what the app shows: published banner + live linked content
const isBannerVisible = (b) => b.publishStatus !== false && linkedIsLive(b);

// The app casts these fields strictly (verticalPoster['url'], `as num`, `as bool`, cast as a list of maps),
// so one old/odd record must not break the whole banner list → make the types safe here.
const asImage = (v) => (typeof v === "string" ? { url: v } : v && typeof v === "object" ? { ...v, url: typeof v.url === "string" ? v.url : "" } : { url: "" });
const asNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const safeMovie = (m) => {
  if (!m || typeof m !== "object" || m._bsontype) return m || null; // not populated (plain id) → as is
  return {
    ...m,
    verticalPoster: asImage(m.verticalPoster),
    horizontalBanner: asImage(m.horizontalBanner),
    releaseYear: asNum(m.releaseYear),
    imdbRating: asNum(m.imdbRating),
    genres: Array.isArray(m.genres) ? m.genres : m.genres ? [String(m.genres)] : [],
  };
};
// legacy "cast" on a banner: keep only proper person objects
const safeCast = (cast) => (Array.isArray(cast) ? cast.filter((p) => p && typeof p === "object" && !Array.isArray(p)) : []);

// App reads bannerImage / logoImage as plain URL strings (objects also accepted)
const format = (doc) => {
  const raw = doc.toObject ? doc.toObject() : doc;
  const b = { ...raw, movieId: safeMovie(raw.movieId) };
  if (raw.cast !== undefined) b.cast = safeCast(raw.cast);
  const isSeries = b.bannerType === "web_series" || (!!b.webseriesId && !b.movieId);
  const series = b.webseriesId && typeof b.webseriesId === "object" ? formatWebSeries(b.webseriesId) : null;
  // no own banner picture → the linked movie / series' landscape banner is used (read live, so it follows changes)
  const own = b.bannerImage?.url || "";
  const linkedWide = series ? series.horizontalBanner || "" : b.movieId && typeof b.movieId === "object" ? b.movieId.horizontalBanner?.url || "" : "";
  const image = own || linkedWide;
  return {
    ...b,
    logoImage: b.logoImage?.url || "",
    bannerImage: image,
    mobileImage: b.mobileImage?.url || image, // website on phones: own tall picture, else the normal one
    ownMobileImage: b.mobileImage?.url || "",
    webImage: image,
    ownBannerImage: own, // admin: the picture uploaded for this banner ("" = uses the movie / series banner)
    bannerType: isSeries ? "web_series" : "single_movie",
    type: isSeries ? "webseries" : "movie",
    contentType: isSeries ? "webseries" : "movie",
    webseriesId: series || b.webseriesId || null,
    webSeriesId: series ? series._id : b.webseriesId || null,
    genres: series ? series.genres : b.movieId?.genres || [],
    language: series ? series.lang : b.movieId?.lang || "",
    imdbRating: asNum(series ? series.imdbRating : b.movieId?.imdbRating),
    publishStatus: b.publishStatus !== false && b.publishStatus !== "false",
    displayOrder: asNum(b.displayOrder),
    ageLimit: series ? series.ageRating : b.movieId?.ageRating || "",
    linkedVisible: linkedIsLive(b),
  };
};

const readBanner = (b) => {
  const d = {};
  if (b.title !== undefined) d.title = parseStr(b.title);
  if (b.description !== undefined) d.description = parseStr(b.description);
  if (b.bannerType !== undefined) d.bannerType = parseStr(b.bannerType) === "web_series" ? "web_series" : "single_movie";
  if (b.categoryId !== undefined) d.categoryId = isId(parseStr(b.categoryId)) ? parseStr(b.categoryId) : null;
  if (b.movieId !== undefined) d.movieId = isId(parseStr(b.movieId)) ? parseStr(b.movieId) : null;
  const ws = b.webseriesId ?? b.webSeriesId;
  if (ws !== undefined) d.webseriesId = isId(parseStr(ws)) ? parseStr(ws) : null;
  if (b.displayOrder !== undefined) d.displayOrder = parseNum(b.displayOrder, 0);
  if (b.visibleOn !== undefined) d.visibleOn = parseStr(b.visibleOn) || "home";
  if (b.publishStatus !== undefined) d.publishStatus = parseBool(b.publishStatus, true);
  // keep only the link that matches the type
  if (d.bannerType === "web_series") d.movieId = null;
  if (d.bannerType === "single_movie") d.webseriesId = null;
  return d;
};

// landscape banner URL of the movie / series a banner links to ("" when it has none)
const linkedWideImage = async (d) => {
  if (d.webseriesId) {
    const WebSeries = require("../models/webseries");
    const w = await WebSeries.findById(d.webseriesId, "banner").lean();
    return w?.banner?.url || "";
  }
  if (d.movieId) {
    const m = await Movie.findById(d.movieId, "horizontalBanner").lean();
    return m?.horizontalBanner?.url || "";
  }
  return "";
};

const images = async (req, d) => {
  const logo = await uploadImageFile(firstFile(req, "logoImage"), "logo");
  if (logo) d.logoImage = logo;
  const banner = await uploadImageFile(firstFile(req, "bannerImage"), "banner");
  if (banner) d.bannerImage = banner;
  const mobile = await uploadImageFile(firstFile(req, "mobileImage"), "banner_mobile");
  if (mobile) d.mobileImage = mobile;
};

/** GET /api/banners — app: published only (?limit=); admin: all */
exports.getBanners = async (req, res) => {
  const q = {};
  if (!req.isAdmin || parseBool(req.query.publishStatus) === true) q.publishStatus = true;
  let banners = await populate(Banner.find(q).sort({ displayOrder: 1, createdAt: -1 }));
  if (!req.isAdmin) {
    // hide banners whose movie / series can't be opened in the app (before the limit, so hidden ones don't use up slots)
    banners = banners.filter(linkedIsLive);
  }
  const limit = parseNum(req.query.limit);
  if (limit && limit > 0) banners = banners.slice(0, Math.min(100, limit));
  res.json({ success: true, data: banners.map(format) });
};

exports.getBannerById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const banner = await populate(Banner.findById(req.params.id));
  if (!banner || (!req.isAdmin && !isBannerVisible(banner))) throw new HttpError(404, "Banner not found");
  res.json({ success: true, data: format(banner) });
};

exports.createBanner = async (req, res) => {
  const d = readBanner(req.body);
  if (!d.title) throw new HttpError(400, "Title is required");
  if (!d.movieId && !d.webseriesId) throw new HttpError(400, "Choose the movie or web series this banner opens");
  // no picture uploaded → fine when the movie / series has its own landscape banner (used automatically)
  if (!firstFile(req, "bannerImage") && !(await linkedWideImage(d))) {
    throw new HttpError(400, "Please upload a banner image (the chosen title has no landscape banner picture of its own)");
  }
  await images(req, d);
  if (d.displayOrder === undefined) {
    const lastOne = await Banner.findOne({}).sort({ displayOrder: -1 }).select("displayOrder");
    d.displayOrder = (lastOne?.displayOrder ?? -1) + 1;
  }
  d.createdBy = req.admin?._id;
  const banner = await Banner.create(d);
  res.status(201).json({ success: true, message: "Banner created", data: format(await populate(Banner.findById(banner._id))) });
};

exports.updateBanner = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new HttpError(404, "Banner not found");
  const d = readBanner(req.body);
  const oldImages = [];
  await images(req, d);
  if (d.logoImage && banner.logoImage?.publicId && banner.logoImage.publicId !== d.logoImage.publicId) oldImages.push(banner.logoImage.publicId);
  if (d.bannerImage && banner.bannerImage?.publicId && banner.bannerImage.publicId !== d.bannerImage.publicId) oldImages.push(banner.bannerImage.publicId);
  // the logo is optional → removeLogoImage=true clears it (the banner image is required and can only be replaced)
  if (!d.logoImage && parseBool(req.body.removeLogoImage)) {
    if (banner.logoImage?.publicId) oldImages.push(banner.logoImage.publicId);
    d.logoImage = { url: "", publicId: "" };
  }
  if (d.mobileImage && banner.mobileImage?.publicId && banner.mobileImage.publicId !== d.mobileImage.publicId) oldImages.push(banner.mobileImage.publicId);
  if (!d.mobileImage && parseBool(req.body.removeMobileImage)) {
    if (banner.mobileImage?.publicId) oldImages.push(banner.mobileImage.publicId);
    d.mobileImage = { url: "", publicId: "" };
  }
  // removeBannerImage=true → use the linked movie / series banner instead of an own picture
  if (!d.bannerImage && parseBool(req.body.removeBannerImage)) {
    if (banner.bannerImage?.publicId) oldImages.push(banner.bannerImage.publicId);
    d.bannerImage = { url: "", publicId: "" };
  }
  banner.set(d);
  // a banner must open something (the app can't use one that links nowhere)
  if (!banner.movieId && !banner.webseriesId) {
    const newIds = [d.logoImage?.publicId, d.bannerImage?.publicId].filter(Boolean);
    for (const id of newIds) bunny.deleteImage(id); // just uploaded for this failed save
    throw new HttpError(400, "Choose the movie or series this banner opens");
  }
  // no own picture and the linked title has no landscape banner either → the app would show an empty slide
  if (!banner.bannerImage?.url && !(await linkedWideImage(banner))) {
    const newIds = [d.logoImage?.publicId].filter(Boolean);
    for (const id of newIds) bunny.deleteImage(id);
    throw new HttpError(400, "Please upload a banner image (the chosen title has no landscape banner picture of its own)");
  }
  await banner.save();
  for (const id of oldImages) bunny.deleteImage(id);
  res.json({ success: true, message: "Banner updated", data: format(await populate(Banner.findById(banner._id))) });
};

exports.deleteBanner = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw new HttpError(404, "Banner not found");
  bunny.deleteImage(banner.logoImage?.publicId);
  bunny.deleteImage(banner.bannerImage?.publicId);
  bunny.deleteImage(banner.mobileImage?.publicId);
  res.json({ success: true, message: "Banner deleted" });
};

exports.togglePublish = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new HttpError(404, "Banner not found");
  banner.publishStatus = !banner.publishStatus;
  await banner.save();
  res.json({ success: true, message: banner.publishStatus ? "Banner shown" : "Banner hidden", data: format(await populate(Banner.findById(banner._id))) });
};

// Body: { ids: [banner ids in new order] }
exports.reorder = async (req, res) => {
  const raw = req.body?.ids;
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "ids must be a non-empty list of banner ids");
  const ids = raw.map(String).filter(isId);
  if (ids.length === 0) throw new HttpError(400, "No valid banner ids were sent");
  await Banner.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { displayOrder: i } } })));
  res.json({ success: true, message: "Order saved" });
};

// kept for old admin builds
exports.getMoviesForDropdown = async (req, res) => {
  const movies = await Movie.find({}, "movieTitle releaseYear verticalPoster").sort({ movieTitle: 1 }).lean();
  res.json({ success: true, data: movies });
};
