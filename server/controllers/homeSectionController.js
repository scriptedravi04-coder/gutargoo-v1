// Home page rows ("sections") — built in the admin's Section Builder, shown in the app.
const HomeSection = require("../models/HomeSection");
const Movie = require("../models/Movie");
const WebSeries = require("../models/webseries");
const Category = require("../models/Category");
const ContinueWatching = require("../models/ContinueWatching");
const { sectionItemFromMovie, sectionItemFromSeries } = require("../lib/format");
const { HttpError, isId, parseBool, parseNum, parseStr, parseArray } = require("../lib/http");

const SOURCES = ["auto", "most_viewed", "recently_added", "watch_time_based", "admin_selected"];
const STYLES = ["horizontal_banner", "vertical_banner", "big_horizontal", "big_vertical", "index_horizontal", "index_vertical"];

const readSection = (b) => {
  const d = {};
  if (b.title !== undefined) d.title = parseStr(b.title);
  if (b.contentSource !== undefined && SOURCES.includes(b.contentSource)) d.contentSource = b.contentSource;
  if (b.displayStyle !== undefined && STYLES.includes(b.displayStyle)) d.displayStyle = b.displayStyle;
  if (b.categoryId !== undefined) d.categoryId = isId(b.categoryId) ? b.categoryId : null;
  if (b.isActive !== undefined) d.isActive = parseBool(b.isActive, true);
  if (b.trendingPeriodDays !== undefined) d.trendingPeriodDays = Math.max(1, parseNum(b.trendingPeriodDays, 7));
  if (b.itemLimit !== undefined) d.itemLimit = Math.min(50, Math.max(1, parseNum(b.itemLimit, 20)));
  const movies = b.sectionData?.movies ?? b.movies;
  const webseries = b.sectionData?.webseries ?? b.webseries;
  if (movies !== undefined || webseries !== undefined) {
    d.sectionData = {
      movies: parseArray(movies).map((x) => (typeof x === "object" ? x?._id : x)).filter(isId),
      webseries: parseArray(webseries).map((x) => (typeof x === "object" ? x?._id : x)).filter(isId),
    };
  }
  return d;
};

/* ───────── Admin ───────── */

exports.getSections = async (req, res) => {
  const sections = await HomeSection.find({})
    .sort({ displayOrder: 1, createdAt: 1 })
    .populate("categoryId", "name categoryType")
    .populate("sectionData.movies", "movieTitle verticalPoster publishStatus")
    .populate("sectionData.webseries", "title verticalPoster thumbnail contentType isPublished");
  res.json({ success: true, data: sections });
};

exports.getSectionById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const section = await HomeSection.findById(req.params.id);
  if (!section) throw new HttpError(404, "Section not found");
  res.json({ success: true, data: section });
};

exports.createSection = async (req, res) => {
  const d = readSection(req.body);
  if (!d.title) throw new HttpError(400, "Section title is required");
  const lastOne = await HomeSection.findOne({}).sort({ displayOrder: -1 }).select("displayOrder");
  d.displayOrder = (lastOne?.displayOrder ?? -1) + 1; // new sections go to the bottom
  const section = await HomeSection.create(d);
  res.status(201).json({ success: true, message: "Section created", data: section });
};

exports.updateSection = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const section = await HomeSection.findByIdAndUpdate(req.params.id, readSection(req.body), { returnDocument: "after", runValidators: true });
  if (!section) throw new HttpError(404, "Section not found");
  res.json({ success: true, message: "Section updated", data: section });
};

exports.deleteSection = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const section = await HomeSection.findByIdAndDelete(req.params.id);
  if (!section) throw new HttpError(404, "Section not found");
  res.json({ success: true, message: "Section deleted" });
};

exports.toggleSection = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const section = await HomeSection.findById(req.params.id);
  if (!section) throw new HttpError(404, "Section not found");
  section.isActive = !section.isActive;
  await section.save();
  res.json({ success: true, message: section.isActive ? "Section shown" : "Section hidden", data: section });
};

// Body: { ids: [all section ids in the new order] }
exports.reorderSections = async (req, res) => {
  const ids = parseArray(req.body.ids).filter(isId);
  if (!ids.length) throw new HttpError(400, "ids required");
  await HomeSection.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { displayOrder: i } } })));
  // any section not in the list goes after, keeping its relative order
  const rest = await HomeSection.find({ _id: { $nin: ids } }).sort({ displayOrder: 1, createdAt: 1 }).select("_id");
  if (rest.length) {
    await HomeSection.bulkWrite(rest.map((s, i) => ({ updateOne: { filter: { _id: s._id }, update: { displayOrder: ids.length + i } } })));
  }
  res.json({ success: true, message: "Order saved" });
};

/* ───────── App ───────── */

const { visibleMovieQuery, visibleSeriesQuery } = require("../lib/visibility");

// keep the order of an id list
const inOrder = (ids, docs) => {
  const map = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => map.get(String(id))).filter(Boolean);
};

const mostWatchedMovieIds = async (days, limit) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await ContinueWatching.aggregate([
    { $match: { updatedAt: { $gte: since } } },
    { $group: { _id: "$movie", total: { $sum: "$watchedTime" } } },
    { $sort: { total: -1 } },
    { $limit: limit * 2 },
  ]);
  return rows.map((r) => r._id);
};

/** Resolve one section into the list of cards the app shows. */
const resolveItems = async (section, categoriesById) => {
  const limit = section.displayStyle === "index_vertical" || section.displayStyle === "index_horizontal" ? 10 : section.itemLimit || 20;
  const picked = {
    movies: section.sectionData?.movies || [],
    webseries: section.sectionData?.webseries || [],
  };
  const source =
    section.contentSource === "auto"
      ? picked.movies.length || picked.webseries.length
        ? "admin_selected"
        : "recently_added"
      : section.contentSource;

  if (source === "admin_selected") {
    const [movies, series] = await Promise.all([
      Movie.find({ _id: { $in: picked.movies }, ...visibleMovieQuery() }),
      WebSeries.find({ _id: { $in: picked.webseries }, ...visibleSeriesQuery() }),
    ]);
    const items = [
      ...inOrder(picked.movies, movies).map(sectionItemFromMovie),
      ...inOrder(picked.webseries, series).map(sectionItemFromSeries),
    ];
    // "Top 10" styles show at most 10, even when more are hand-picked
    return String(section.displayStyle || "").startsWith("index_") ? items.slice(0, 10) : items;
  }

  // Automatic sections: the category (if any) decides movies vs web series vs TV shows
  const catType = section.categoryId ? categoriesById.get(String(section.categoryId))?.categoryType : null;
  const wantSeries = catType === "webseries" || catType === "tvshows" || catType === "tvshow";
  const seriesType = catType === "tvshows" || catType === "tvshow" ? "tvshow" : { $ne: "tvshow" };

  if (wantSeries) {
    const sort = source === "most_viewed" || source === "watch_time_based" ? { viewCount: -1 } : { createdAt: -1 };
    const series = await WebSeries.find({ ...visibleSeriesQuery(), contentType: seriesType }).sort(sort).limit(limit);
    return series.map(sectionItemFromSeries);
  }

  if (source === "watch_time_based") {
    const ids = await mostWatchedMovieIds(section.trendingPeriodDays || 7, limit);
    const movies = await Movie.find({ _id: { $in: ids }, ...visibleMovieQuery() });
    let list = inOrder(ids, movies).slice(0, limit);
    if (list.length < limit) {
      const more = await Movie.find({ _id: { $nin: list.map((m) => m._id) }, ...visibleMovieQuery() })
        .sort({ viewCount: -1 })
        .limit(limit - list.length);
      list = list.concat(more);
    }
    return list.map(sectionItemFromMovie);
  }

  const sort = source === "most_viewed" ? { viewCount: -1, createdAt: -1 } : { createdAt: -1 };
  const movies = await Movie.find(visibleMovieQuery()).sort(sort).limit(limit);
  return movies.map(sectionItemFromMovie);
};

/** GET /api/admin/sections/allList — what the app's home screen reads. */
exports.getSectionsMobile = async (req, res) => {
  const q = { isActive: { $ne: false } };
  if (isId(req.query.categoryId)) q.categoryId = req.query.categoryId;
  const [sections, categories] = await Promise.all([
    HomeSection.find(q).sort({ displayOrder: 1, createdAt: 1 }).lean(),
    Category.find({}).lean(),
  ]);
  const categoriesById = new Map(categories.map((c) => [String(c._id), c]));

  const data = [];
  for (const section of sections) {
    const items = await resolveItems(section, categoriesById);
    const hasSeries = items.some((i) => i.type !== "movie");
    const hasMovies = items.some((i) => i.type === "movie");
    data.push({
      ...section,
      categoryId: section.categoryId ? String(section.categoryId) : null,
      sectionData: items,
      type: hasSeries && !hasMovies ? items[0].type : "movie",
    });
  }
  res.json({ success: true, data });
};
