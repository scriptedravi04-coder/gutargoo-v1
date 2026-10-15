// Web series and TV shows (TV shows are web series with contentType "tvshow").
const WebSeries = require("../models/webseries");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");
const bunny = require("../services/bunnyService");
const { formatWebSeries } = require("../lib/format");
const { uploadImageFile, firstFile, videoDocFromBunny } = require("../lib/media");
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

// delete a Bunny video only if nothing else uses it
const deleteVideoIfUnused = async (videoId) => {
  if (!videoId) return;
  const used = await WebSeries.exists({
    $or: [{ "trailer.videoId": videoId }, { "seasons.episodes.videoFile.videoId": videoId }],
  });
  if (!used) await bunny.deleteVideo(videoId);
};

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

const seriesImages = async (req, d) => {
  for (const [field, prefix] of [["thumbnail", "ws_thumb"], ["verticalPoster", "ws_poster"], ["banner", "ws_banner"]]) {
    const img = await uploadImageFile(firstFile(req, field), prefix);
    if (img) d[field] = img;
  }
};

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
  if (!req.isAdmin) WebSeries.updateOne({ _id: ws._id }, { $inc: { viewCount: 1 } }).catch(() => {});
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
  let oldTrailer = null;
  const trailerId = parseStr(req.body.trailerVideoId);
  if (trailerId && trailerId !== ws.trailer?.videoId) {
    oldTrailer = ws.trailer?.videoId;
    d.trailer = await videoDocFromBunny(trailerId);
  }
  if (parseBool(req.body.removeTrailer)) {
    oldTrailer = ws.trailer?.videoId;
    d.trailer = {};
    if (d.customTrailerUrl === undefined || (oldTrailer && d.customTrailerUrl.includes(oldTrailer))) d.customTrailerUrl = "";
  }
  ws.set(d);
  await ws.save();
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
  s.deleteOne();
  await ws.save();
  for (const id of videoIds) await deleteVideoIfUnused(id);
  send(res, ws, "Season deleted");
};

/* ───────── Episodes ───────── */

const readEpisode = (b) => {
  const d = {};
  if (b.title !== undefined) d.title = parseStr(b.title);
  if (b.description !== undefined) d.description = parseStr(b.description);
  if (b.episodeNumber !== undefined) d.episodeNumber = parseNum(b.episodeNumber);
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
  if (thumb) d.thumbnail = thumb;
  let oldVideo = null;
  const videoId = parseStr(req.body.videoId);
  if (videoId && videoId !== e.videoFile?.videoId) {
    oldVideo = e.videoFile?.videoId;
    d.videoFile = await videoDocFromBunny(videoId);
    // drop a "custom link" that only pointed at the old video
    const custom = d.customVideoUrl ?? e.customVideoUrl;
    if (custom && oldVideo && custom.includes(oldVideo)) d.customVideoUrl = "";
  }
  e.set(d);
  await ws.save();
  await deleteVideoIfUnused(oldVideo);
  send(res, ws, "Episode updated");
};

exports.deleteEpisode = async (req, res) => {
  const ws = await load(req.params.id);
  const s = findSeason(ws, req.params.seasonId);
  const e = findEpisode(s, req.params.episodeId);
  const videoId = e.videoFile?.videoId;
  e.deleteOne();
  await ws.save();
  await deleteVideoIfUnused(videoId);
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
