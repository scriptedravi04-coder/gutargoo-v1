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

// App reads bannerImage / logoImage as plain URL strings (objects also accepted)
const format = (doc) => {
  const b = doc.toObject ? doc.toObject() : doc;
  const isSeries = b.bannerType === "web_series" || (!!b.webseriesId && !b.movieId);
  const series = b.webseriesId && typeof b.webseriesId === "object" ? formatWebSeries(b.webseriesId) : null;
  return {
    ...b,
    logoImage: b.logoImage?.url || "",
    bannerImage: b.bannerImage?.url || "",
    mobileImage: b.bannerImage?.url || "",
    webImage: b.bannerImage?.url || "",
    bannerType: isSeries ? "web_series" : "single_movie",
    type: isSeries ? "webseries" : "movie",
    contentType: isSeries ? "webseries" : "movie",
    webseriesId: series || b.webseriesId || null,
    webSeriesId: series ? series._id : b.webseriesId || null,
    genres: series ? series.genres : b.movieId?.genres || [],
    language: series ? series.lang : b.movieId?.lang || "",
    imdbRating: series ? series.imdbRating : b.movieId?.imdbRating || 0,
    ageLimit: series ? series.ageRating : b.movieId?.ageRating || "",
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

const images = async (req, d) => {
  const logo = await uploadImageFile(firstFile(req, "logoImage"), "logo");
  if (logo) d.logoImage = logo;
  const banner = await uploadImageFile(firstFile(req, "bannerImage"), "banner");
  if (banner) d.bannerImage = banner;
};

/** GET /api/banners — app: published only (?limit=); admin: all */
exports.getBanners = async (req, res) => {
  const q = {};
  if (!req.isAdmin || parseBool(req.query.publishStatus) === true) q.publishStatus = true;
  let query = populate(Banner.find(q).sort({ displayOrder: 1, createdAt: -1 }));
  const limit = parseNum(req.query.limit);
  if (limit) query = query.limit(Math.min(100, limit));
  let banners = await query;
  if (!req.isAdmin) {
    // hide banners whose movie / series can't be opened in the app
    banners = banners.filter((b) =>
      b.webseriesId ? b.webseriesId.isPublished !== false : b.movieId ? isMovieVisible(b.movieId) : false
    );
  }
  res.json({ success: true, data: banners.map(format) });
};

exports.getBannerById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const banner = await populate(Banner.findById(req.params.id));
  if (!banner) throw new HttpError(404, "Banner not found");
  res.json({ success: true, data: format(banner) });
};

exports.createBanner = async (req, res) => {
  const d = readBanner(req.body);
  if (!d.title) throw new HttpError(400, "Title is required");
  if (!d.movieId && !d.webseriesId) throw new HttpError(400, "Choose the movie or web series this banner opens");
  await images(req, d);
  if (!d.bannerImage) throw new HttpError(400, "Banner image is required");
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
  if (d.logoImage && banner.logoImage?.publicId) oldImages.push(banner.logoImage.publicId);
  if (d.bannerImage && banner.bannerImage?.publicId) oldImages.push(banner.bannerImage.publicId);
  banner.set(d);
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
  const ids = (req.body.ids || []).filter(isId);
  await Banner.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { displayOrder: i } } })));
  res.json({ success: true, message: "Order saved" });
};

// kept for old admin builds
exports.getMoviesForDropdown = async (req, res) => {
  const movies = await Movie.find({}, "movieTitle releaseYear verticalPoster").sort({ movieTitle: 1 }).lean();
  res.json({ success: true, data: movies });
};
