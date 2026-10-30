// Web series and TV shows (TV shows are web series with contentType "tvshow").
const WebSeries = require("../models/webseries");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");
const bunny = require("../services/bunnyService");
const { formatWebSeries } = require("../lib/format");
const { uploadImageFile, firstFile, videoDocFromBunny, deleteImages, deleteVideoIfUnused } = require("../lib/media");
const { countView } = require("../lib/views");
const { HttpError, isId, parseBool, parseNum, parseStr, parseArray, parseDate, escapeRegex } = require("../lib/http");

const load = async (id) => {
  if (!isId(id)) throw new HttpError(400, "Invalid id");
  const ws = await WebSeries.findById(id);
  if (!ws) throw new HttpError(404, "Web series not found");
  return ws;
};

const findSeason = (ws, seasonId) => {
  const s = ws.seasons.id(seasonId);
  if (!s) throw new HttpError(404, "Season not found");
  return s;
};

const findEpisode = (season, episodeId) => {
  const e = season.episodes.id(episodeId);
  if (!e) throw new HttpError(404, "Episode not found");
  return e;
};

const send = (res, ws, message, status = 200) =>
  res.status(status).json({ success: true, message, data: formatWebSeries(ws, { admin: true }) });

// true when a link is one of our own Bunny video links (…/<guid>/playlist.m3u8, also through /stream/)
const isBunnyLink = (url) => /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/(playlist\.m3u8|play_\d+p\.mp4)/i.test(url || "");

// deleteVideoIfUnused (lib/media): deletes a Bunny video only if no movie or series uses it

/* ───────── Series ───────── */

const readSeries = (b) => {
  const d = {};
  for (const k of ["title", "description", "lang", "ageRating", "customTrailerUrl"]) {
    const v = parseStr(b[k]);
    if (v !== undefined) d[k] = v;
  }
  if (b.genres !== undefined || b.genre !== undefined) d.genre = parseArray(b.genres ?? b.genre).map(String);
  if (b.imdbRating !== undefined) d.imdbRating = parseNum(b.imdbRating, 0);
  if (b.releaseDate !== undefined) d.releaseDate = parseDate(b.releaseDate) || null;
  if (b.contentType !== undefined) d.contentType = parseStr(b.contentType) === "tvshow" ? "tvshow" : "webseries";
  if (b.isPublished !== undefined) d.isPublished = parseBool(b.isPublished, true);
  if (b.subscriptionRequired !== undefined) d.subscriptionRequired = parseBool(b.subscriptionRequired, false);
  if (b.category !== undefined) d.category = isId(parseStr(b.category)) ? parseStr(b.category) : null;
  if (b.castAndCrew !== undefined) d.castAndCrew = parseArray(b.castAndCrew).filter(isId);
  return d;
};

const SERIES_IMAGES = [["thumbnail", "ws_thumb"], ["verticalPoster", "ws_poster"], ["banner", "ws_banner"]];
// optional images the admin can remove with remove<Field>=true (the poster stays — the app needs it)
const REMOVABLE_SERIES_IMAGES = { thumbnail: "removeThumbnail", banner: "removeBanner" };

const seriesImages = async (req, d) => {
  for (const [field, prefix] of SERIES_IMAGES) {
    const img = await uploadImageFile(firstFile(req, field), prefix);
    if (img) d[field] = img;
  }
};

// every Bunny Storage image id a series uses (its images + episode thumbnails)
const seriesImageIds = (ws) => [
  ...SERIES_IMAGES.map(([f]) => ws[f]?.publicId),
  ...(ws.seasons || []).flatMap((s) => s.episodes.map((e) => e.thumbnail?.publicId)),
].filter(Boolean);

exports.getAll = async (req, res) => {
  const q = {};
  if (!req.isAdmin) q.isPublished = { $ne: false };
  if (req.query.contentType === "tvshow" || req.query.type === "tvshow") q.contentType = "tvshow";
  if (req.query.contentType === "webseries" || req.query.type === "webseries") q.contentType = { $ne: "tvshow" };
  if (req.query.search) q.title = { $regex: escapeRegex(req.query.search), $options: "i" };
  const list = await WebSeries.find(q).populate("category", "name categoryType").populate("castAndCrew").sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list.map((w) => formatWebSeries(w, { admin: req.isAdmin })) });
};

exports.getById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const ws = await WebSeries.findById(req.params.id).populate("category", "name categoryType").populate("castAndCrew");
  if (!ws || (!req.isAdmin && ws.isPublished === false)) throw new HttpError(404, "Web series not found");
  if (!req.isAdmin) countView(WebSeries, "w", ws._id, req); // once per viewer per 6 h; doesn't slow the reply
  res.json({ success: true, data: formatWebSeries(ws, { admin: req.isAdmin }) });
};

exports.create = async (req, res) => {
  const d = readSeries(req.body);
  if (!d.title) throw new HttpError(400, "Title is required");
  await seriesImages(req, d);
  const trailerId = parseStr(req.body.trailerVideoId);
  if (trailerId) d.trailer = await videoDocFromBunny(trailerId);
  d.createdBy = req.admin?._id;
  const ws = await WebSeries.create(d);
  send(res, ws, "Web series created", 201);
};

exports.update = async (req, res) => {
  const ws = await load(req.params.id);
  const d = readSeries(req.body);
  await seriesImages(req, d);
  const oldImages = [];
  for (const [field] of SERIES_IMAGES) {
    const oldId = ws[field]?.publicId;
    if (d[field]) {
      if (oldId && oldId !== d[field].publicId) oldImages.push(oldId);
    } else if (REMOVABLE_SERIES_IMAGES[field] && parseBool(req.body[REMOVABLE_SERIES_IMAGES[field]])) {
      if (oldId) oldImages.push(oldId);
      d[field] = undefined;
    }
  }
  let oldTrailer = null;
  const trailerId = parseStr(req.body.trailerVideoId);
  if (trailerId && trailerId !== ws.trailer?.videoId) {
    oldTrailer = ws.trailer?.videoId;
    d.trailer = await videoDocFromBunny(trailerId);
    // the trailer link plays instead of the uploaded trailer → a new upload replaces it,
    // unless the link was changed in this same save
    const linkChanged = d.customTrailerUrl !== undefined && d.customTrailerUrl !== (ws.customTrailerUrl || "");
    if (!linkChanged) d.customTrailerUrl = "";
  }
  if (parseBool(req.body.removeTrailer)) {
    oldTrailer = ws.trailer?.videoId;
    d.trailer = undefined; // removed from the record → the app gets trailer: null (not an empty object)
    // a trailer link that is one of our own Bunny links (this or another video) goes too — else the button stays
    if (d.customTrailerUrl === undefined || (oldTrailer && d.customTrailerUrl.includes(oldTrailer)) || isBunnyLink(d.customTrailerUrl)) {
      d.customTrailerUrl = "";
    }
  }
  ws.set(d);
  await ws.save();
  deleteImages(oldImages, seriesImageIds(ws));
  await deleteVideoIfUnused(oldTrailer);
  send(res, ws, "Web series updated");
};

exports.remove = async (req, res) => {
  const ws = await load(req.params.id);
  const videoIds = [ws.trailer?.videoId, ...ws.seasons.flatMap((s) => s.episodes.map((e) => e.videoFile?.videoId))].filter(Boolean);
  await ws.deleteOne();
  await Promise.all([
    HomeSection.updateMany({}, { $pull: { "sectionData.webseries": ws._id } }),
    Banner.updateMany({ webseriesId: ws._id }, { $set: { webseriesId: null, publishStatus: false } }),
  ]);
  for (const id of videoIds) await deleteVideoIfUnused(id);
  deleteImages(seriesImageIds(ws));
  res.json({ success: true, message: "Web series deleted" });
};

exports.togglePublish = async (req, res) => {
  const ws = await load(req.params.id);
  ws.isPublished = !ws.isPublished;
  await ws.save();
  send(res, ws, ws.isPublished ? "Published" : "Unpublished");
};

/* ───────── Seasons ───────── */

exports.addSeason = async (req, res) => {
  const ws = await load(req.params.id);
  const seasonNumber = parseNum(req.body.seasonNumber) || (Math.max(0, ...ws.seasons.map((s) => s.seasonNumber)) + 1);
  if (ws.seasons.some((s) => s.seasonNumber === seasonNumber)) throw new HttpError(400, `Season ${seasonNumber} already exists`);
  ws.seasons.push({
    seasonNumber,
    title: parseStr(req.body.title) || `Season ${seasonNumber}`,
    releaseDate: parseDate(req.body.releaseDate),
    episodes: [],
  });
  await ws.save();
  send(res, ws, "Season added", 201);
};

exports.updateSeason = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const n = parseNum(req.body.seasonNumber);
  if (n && n !== s.seasonNumber && ws.seasons.some((x) => x.seasonNumber === n)) throw new HttpError(400, `Season ${n} already exists`);
  if (n) s.seasonNumber = n;
  if (req.body.title !== undefined) s.title = parseStr(req.body.title);
  if (req.body.releaseDate !== undefined) s.releaseDate = parseDate(req.body.releaseDate);
  await ws.save();
  send(res, ws, "Season updated");
};

exports.deleteSeason = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const videoIds = s.episodes.map((e) => e.videoFile?.videoId).filter(Boolean);
  const thumbs = s.episodes.map((e) => e.thumbnail?.publicId);
  s.deleteOne();
  await ws.save();
  for (const id of videoIds) await deleteVideoIfUnused(id);
  deleteImages(thumbs, seriesImageIds(ws));
  send(res, ws, "Season deleted");
};

/* ───────── Episodes ───────── */

const readEpisode = (b) => {
  const d = {};
  if (b.title !== undefined) d.title = parseStr(b.title);
  if (b.description !== undefined) d.description = parseStr(b.description);
  if (b.episodeNumber !== undefined) d.episodeNumber = parseNum(b.episodeNumber);
  // empty = today (as the admin form says)
  if (b.releaseDate !== undefined) d.releaseDate = parseDate(b.releaseDate) || new Date();
  if (b.isPublished !== undefined) d.isPublished = parseBool(b.isPublished, true);
  if (b.customVideoUrl !== undefined) d.customVideoUrl = parseStr(b.customVideoUrl);
  if (b.skipIntroStart !== undefined || b.skipIntroEnd !== undefined) {
    d.skipIntro = { start: parseNum(b.skipIntroStart, 0), end: parseNum(b.skipIntroEnd, 0) };
  }
  return d;
};

exports.addEpisode = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const d = readEpisode(req.body);
  if (!d.title) throw new HttpError(400, "Episode title is required");
  if (!d.episodeNumber) d.episodeNumber = Math.max(0, ...s.episodes.map((e) => e.episodeNumber)) + 1;
  if (s.episodes.some((e) => e.episodeNumber === d.episodeNumber)) throw new HttpError(400, `Episode ${d.episodeNumber} already exists`);
  const thumb = await uploadImageFile(firstFile(req, "thumbnail"), "ep_thumb");
  if (thumb) d.thumbnail = thumb;
  const videoId = parseStr(req.body.videoId);
  if (videoId) d.videoFile = await videoDocFromBunny(videoId);
  s.episodes.push(d);
  await ws.save();
  send(res, ws, "Episode added", 201);
};

exports.updateEpisode = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const e = findEpisode(s, req.params.episodeId);
  const d = readEpisode(req.body);
  if (d.episodeNumber && d.episodeNumber !== e.episodeNumber && s.episodes.some((x) => x.episodeNumber === d.episodeNumber)) {
    throw new HttpError(400, `Episode ${d.episodeNumber} already exists`);
  }
  const thumb = await uploadImageFile(firstFile(req, "thumbnail"), "ep_thumb");
  const oldThumb = e.thumbnail?.publicId;
  const oldImages = [];
  if (thumb) {
    d.thumbnail = thumb;
    if (oldThumb && oldThumb !== thumb.publicId) oldImages.push(oldThumb);
  } else if (parseBool(req.body.removeThumbnail)) {
    d.thumbnail = undefined;
    if (oldThumb) oldImages.push(oldThumb);
  }
  let oldVideo = null;
  const videoId = parseStr(req.body.videoId);
  if (videoId && videoId !== e.videoFile?.videoId) {
    oldVideo = e.videoFile?.videoId;
    d.videoFile = await videoDocFromBunny(videoId);
    // the "custom link" plays instead of the uploaded video → a new upload replaces it,
    // unless the link was changed in this same save
    const linkChanged = d.customVideoUrl !== undefined && d.customVideoUrl !== (e.customVideoUrl || "");
    if (!linkChanged) d.customVideoUrl = "";
  }
  e.set(d);
  await ws.save();
  deleteImages(oldImages, seriesImageIds(ws));
  await deleteVideoIfUnused(oldVideo);
  send(res, ws, "Episode updated");
};

exports.deleteEpisode = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const e = findEpisode(s, req.params.episodeId);
  const videoId = e.videoFile?.videoId;
  const thumbId = e.thumbnail?.publicId;
  e.deleteOne();
  await ws.save();
  await deleteVideoIfUnused(videoId);
  deleteImages([thumbId], seriesImageIds(ws));
  send(res, ws, "Episode deleted");
};

// Small list for dropdowns in the admin panel
exports.getOptions = async (req, res) => {
  const list = await WebSeries.find({}, "title contentType verticalPoster thumbnail isPublished").sort({ title: 1 }).lean();
  res.json({
    success: true,
    data: list.map((w) => ({
      _id: w._id,
      title: w.title,
      contentType: w.contentType || "webseries",
      posterUrl: w.verticalPoster?.url || w.thumbnail?.url || "",
      isPublished: w.isPublished,
    })),
  });
};
