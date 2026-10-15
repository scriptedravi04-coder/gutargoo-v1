const Movie = require("../models/Movie");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");
const ContinueWatching = require("../models/ContinueWatching");
const bunny = require("../services/bunnyService");
const { formatMovie, CREW_ROLES } = require("../lib/format");
const { uploadImageFile, firstFile, videoDocFromBunny, videoDocFromFile } = require("../lib/media");
const { visibleMovieQuery, isMovieVisible } = require("../lib/visibility");
const { HttpError, isId, parseBool, parseNum, parseStr, parseArray, parseDate, escapeRegex, paging } = require("../lib/http");

const CREW_KEYS = Object.keys(CREW_ROLES);

// true when a link is one of our own Bunny video links (…/<guid>/playlist.m3u8)
const isBunnyLink = (url) => /\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/(playlist\.m3u8|play_\d+p\.mp4)/i.test(url || "");
const pointsTo = (url, videoId) => !!videoId && String(url || "").includes(videoId);

// "Alice" or { name, character, imageUrl } → stored person
const parsePeople = (value) =>
  parseArray(value)
    .map((p) => (typeof p === "string" ? { name: p } : p || {}))
    .filter((p) => p.name && String(p.name).trim())
    .map((p) => ({
      name: String(p.name).trim(),
      character: p.character || "",
      imageUrl: p.imageUrl || "",
      publicId: p.publicId || "",
    }));

// Photo files are sent as crewImages_<role>_<index> and castImage_<index>
const attachPeoplePhotos = async (req, data) => {
  for (const role of CREW_KEYS) {
    if (!data[role]) continue;
    for (let i = 0; i < data[role].length; i++) {
      const img = await uploadImageFile(firstFile(req, `crewImages_${role}_${i}`), `crew_${role}`);
      if (img) Object.assign(data[role][i], { imageUrl: img.url, publicId: img.publicId });
    }
  }
  if (data.castMembers) {
    for (let i = 0; i < data.castMembers.length; i++) {
      const img = await uploadImageFile(firstFile(req, `castImage_${i}`), "cast");
      if (img) Object.assign(data.castMembers[i], { imageUrl: img.url, publicId: img.publicId });
    }
  }
};

/** Read all movie fields from the request body. Only fields that were sent are returned. */
const readBody = (b, isCreate) => {
  const d = {};
  const str = (k, out = k) => {
    const v = parseStr(b[k]);
    if (v !== undefined) d[out] = v;
  };
  const num = (k) => {
    const v = parseNum(b[k]);
    if (v !== undefined) d[k] = v;
  };
  const bool = (k) => {
    const v = parseBool(b[k]);
    if (v !== undefined) d[k] = v;
  };
  const arr = (k) => {
    if (b[k] !== undefined) d[k] = parseArray(b[k]).map(String).filter(Boolean);
  };

  ["movieTitle", "tagline", "description", "fullStoryline", "lang", "selectedLanguage", "ageRating", "budget",
    "awardsAndNominations", "videoQuality", "audioFormat", "contentVendor", "vendorId", "seoTitle", "seoDescription",
    "customVideoUrl", "customTrailerUrl"].forEach((k) => str(k));
  ["duration", "imdbRating", "releaseYear"].forEach(num);
  ["publishStatus", "subscriptionRequired", "enableAds", "allowDownloads", "featuredMovie"].forEach(bool);
  ["genres", "tags", "productionStudio", "countryOfOrigin", "audioTracks", "subtitles", "seoKeywords"].forEach(arr);

  for (const k of ["publishDate", "expiryDate", "releaseDate"]) {
    if (b[k] !== undefined) d[k] = parseDate(b[k]) || null;
  }
  if (b.skipIntroStart !== undefined || b.skipIntroEnd !== undefined) {
    d.skipIntro = { start: parseNum(b.skipIntroStart, 0), end: parseNum(b.skipIntroEnd, 0) };
  }
  for (const role of CREW_KEYS) if (b[role] !== undefined) d[role] = parsePeople(b[role]);
  if (b.castMembers !== undefined) d.castMembers = parsePeople(b.castMembers);

  if (isCreate) {
    if (d.publishStatus === undefined) d.publishStatus = true;
    if (d.publishStatus && !d.publishDate) d.publishDate = new Date();
  }
  return d;
};

const required = (d) => {
  const missing = [];
  if (!d.movieTitle) missing.push("title");
  if (!d.description) missing.push("description");
  if (!d.lang) missing.push("language");
  if (!d.ageRating) missing.push("age rating");
  if (!d.duration) missing.push("duration");
  if (!d.releaseYear) missing.push("release year");
  if (missing.length) throw new HttpError(400, `Please fill: ${missing.join(", ")}`);
};

/**
 * Video for a movie: either a Bunny video id from a direct upload (movieVideoId / trailerVideoId)
 * or a file sent through the server (movieFile / trailerFile).
 */
const readVideo = async (req, idField, fileField, prefix) => {
  const videoId = parseStr(req.body[idField]);
  if (videoId) return videoDocFromBunny(videoId);
  const file = firstFile(req, fileField);
  if (file) return videoDocFromFile(file, prefix);
  return null;
};

const uploadImages = async (req, d) => {
  for (const [field, prefix] of [["logo", "logo"], ["horizontalBanner", "banner"], ["verticalPoster", "poster"]]) {
    const img = await uploadImageFile(firstFile(req, field), prefix);
    if (img) d[field] = img;
  }
};

exports.createMovie = async (req, res) => {
  const d = readBody(req.body, true);
  required(d);
  d.createdBy = req.admin?._id;
  await uploadImages(req, d);
  const movieFile = await readVideo(req, "movieVideoId", "movieFile", "movie");
  if (movieFile) d.movieFile = movieFile;
  const trailer = await readVideo(req, "trailerVideoId", "trailerFile", "trailer");
  if (trailer) d.trailer = trailer;
  await attachPeoplePhotos(req, d);

  const movie = await Movie.create(d);
  res.status(201).json({ success: true, message: "Movie created", data: formatMovie(movie, { admin: true }) });
};

exports.updateMovie = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw new HttpError(404, "Movie not found");

  const d = readBody(req.body, false);
  await uploadImages(req, d);
  await attachPeoplePhotos(req, d);

  // New video first; delete the old Bunny video only after the new one is saved
  const oldVideos = [];
  const movieFile = await readVideo(req, "movieVideoId", "movieFile", "movie");
  if (movieFile && movieFile.videoId !== movie.movieFile?.videoId) {
    if (movie.movieFile?.videoId) oldVideos.push(movie.movieFile.videoId);
    d.movieFile = movieFile;
    // a "custom link" that is just the old video's link would keep playing the old video
    const custom = d.customVideoUrl ?? movie.customVideoUrl;
    if (custom && pointsTo(custom, movie.movieFile?.videoId)) d.customVideoUrl = "";
  }
  const trailer = await readVideo(req, "trailerVideoId", "trailerFile", "trailer");
  if (trailer && trailer.videoId !== movie.trailer?.videoId) {
    if (movie.trailer?.videoId) oldVideos.push(movie.trailer.videoId);
    d.trailer = trailer;
    const custom = d.customTrailerUrl ?? movie.customTrailerUrl;
    if (custom && pointsTo(custom, movie.trailer?.videoId)) d.customTrailerUrl = "";
  }
  if (parseBool(req.body.removeTrailer)) {
    if (movie.trailer?.videoId) oldVideos.push(movie.trailer.videoId);
    d.trailer = {};
    if (d.customTrailerUrl === undefined || isBunnyLink(d.customTrailerUrl)) d.customTrailerUrl = "";
  }
  if (d.publishStatus === true && !movie.publishStatus && !d.publishDate) d.publishDate = new Date();

  movie.set(d);
  await movie.save();
  // only delete old videos that no other movie still uses
  for (const id of oldVideos) {
    const stillUsed = await Movie.exists({ $or: [{ "movieFile.videoId": id }, { "trailer.videoId": id }] });
    if (!stillUsed) await bunny.deleteVideo(id);
  }
  res.json({ success: true, message: "Movie updated", data: formatMovie(movie, { admin: true }) });
};

/**
 * GET /api/movies
 * App: all published movies (no paging).
 * Admin (logged in): every movie; supports ?page=&limit=&search=&status=published|draft
 * Both: ?title= / ?genres= filters
 */
exports.getMovies = async (req, res) => {
  const q = req.isAdmin ? {} : visibleMovieQuery();
  if (req.isAdmin && req.query.status === "published") q.publishStatus = true;
  if (req.isAdmin && req.query.status === "draft") q.publishStatus = false;
  const search = req.query.search || req.query.title;
  if (search) q.movieTitle = { $regex: escapeRegex(search), $options: "i" };
  if (req.query.genres) q.genres = { $in: parseArray(req.query.genres) };

  if (req.isAdmin && req.query.page) {
    const { page, limit, skip } = paging(req.query, 20);
    const [items, total] = await Promise.all([
      Movie.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Movie.countDocuments(q),
    ]);
    return res.json({
      success: true,
      data: items.map((m) => formatMovie(m, { admin: true })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  const movies = await Movie.find(q).sort({ createdAt: -1 });
  res.json({ success: true, data: movies.map((m) => formatMovie(m, { admin: req.isAdmin })) });
};

exports.getMovieById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie || (!req.isAdmin && !isMovieVisible(movie))) throw new HttpError(404, "Movie not found");
  if (!req.isAdmin) {
    Movie.updateOne({ _id: movie._id }, { $inc: { viewCount: 1 } }).catch(() => {});
  }
  res.json({ success: true, data: formatMovie(movie, { admin: req.isAdmin }) });
};

exports.deleteMovie = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findByIdAndDelete(req.params.id);
  if (!movie) throw new HttpError(404, "Movie not found");

  await Promise.all([
    HomeSection.updateMany({}, { $pull: { "sectionData.movies": movie._id } }),
    Banner.updateMany({ movieId: movie._id }, { $set: { movieId: null, publishStatus: false } }),
    ContinueWatching.deleteMany({ movie: movie._id }),
  ]);
  for (const id of [movie.movieFile?.videoId, movie.trailer?.videoId]) {
    if (!id) continue;
    const stillUsed = await Movie.exists({ $or: [{ "movieFile.videoId": id }, { "trailer.videoId": id }] });
    if (!stillUsed) await bunny.deleteVideo(id);
  }
  res.json({ success: true, message: "Movie deleted" });
};

exports.togglePublish = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw new HttpError(404, "Movie not found");
  movie.publishStatus = !movie.publishStatus;
  if (movie.publishStatus) movie.publishDate = new Date();
  await movie.save();
  res.json({ success: true, message: movie.publishStatus ? "Published" : "Unpublished", data: formatMovie(movie, { admin: true }) });
};

exports.getVideoStreamUrl = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie || (!req.isAdmin && !isMovieVisible(movie))) throw new HttpError(404, "Movie not found");
  const f = formatMovie(movie);
  if (!f.videoStreamUrl) throw new HttpError(404, "Video not found");
  res.json({
    success: true,
    data: {
      hlsUrl: f.videoStreamUrl,
      directPlayUrl: f.directPlayUrl,
      mp4Url: f.mp4Url,
      thumbnailUrl: f.thumbnailUrl,
      status: movie.movieFile?.status ?? null,
      trailer: {
        hlsUrl: f.trailerStreamUrl,
        directPlayUrl: f.trailerDirectPlayUrl,
        mp4Url: f.trailerMp4Url,
        thumbnailUrl: f.trailerThumbnailUrl,
      },
    },
  });
};

// Small list for dropdowns in the admin panel (banners, sections)
exports.getMovieOptions = async (req, res) => {
  const movies = await Movie.find({}, "movieTitle releaseYear verticalPoster publishStatus").sort({ movieTitle: 1 }).lean();
  res.json({
    success: true,
    data: movies.map((m) => ({
      _id: m._id,
      movieTitle: m.movieTitle,
      releaseYear: m.releaseYear,
      posterUrl: m.verticalPoster?.url || "",
      publishStatus: m.publishStatus,
    })),
  });
};
