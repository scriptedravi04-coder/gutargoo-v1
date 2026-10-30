const Movie = require("../models/Movie");
const Banner = require("../models/Banner");
const HomeSection = require("../models/HomeSection");
const ContinueWatching = require("../models/ContinueWatching");
const bunny = require("../services/bunnyService");
const { formatMovie, CREW_ROLES } = require("../lib/format");
const { uploadImageFile, firstFile, videoDocFromBunny, videoDocFromFile, deleteImages, deleteVideoIfUnused } = require("../lib/media");
const { countView } = require("../lib/views");
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

// Only the title is really needed — everything else gets a sensible default so adding a movie is quick.
const required = (d) => {
  if (!d.movieTitle) throw new HttpError(400, "Please fill: title");
};
const fillDefaults = (d) => {
  if (!d.description) d.description = d.tagline || `Watch ${d.movieTitle} on Gutargoo+.`;
  if (!d.lang) d.lang = "Hindi";
  if (!d.ageRating) d.ageRating = "U/A 13+";
  if (!d.releaseYear) d.releaseYear = new Date().getFullYear();
  if (!d.duration) {
    const secs = Number(d.movieFile?.duration) || 0;
    d.duration = secs > 0 ? Math.max(1, Math.round(secs / 60)) : 1; // updated automatically when Bunny finishes the video
  }
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

const IMAGE_FIELDS = [["logo", "logo"], ["horizontalBanner", "banner"], ["verticalPoster", "poster"]];
const uploadImages = async (req, d) => {
  for (const [field, prefix] of IMAGE_FIELDS) {
    const img = await uploadImageFile(firstFile(req, field), prefix);
    if (img) d[field] = img;
  }
};
// Optional images the admin can remove with remove<Field>=true (poster / banner stay — the app needs them)
const REMOVABLE_IMAGES = { logo: "removeLogo" };

// Bunny Storage ids of the movie's own images (people photos are skipped: they can be shared with the Cast & Crew library)
const movieImageIds = (m) => IMAGE_FIELDS.map(([f]) => m[f]?.publicId).filter(Boolean);

// "now" for publishing — but never move a scheduled (future) publish date
const publishDateOnPublish = (current) => (!current || new Date(current).getTime() <= Date.now() ? new Date() : current);

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
  fillDefaults(d);

  const movie = await Movie.create(d);
  res.status(201).json({ success: true, message: "Movie created", data: formatMovie(movie, { admin: true }) });
};

exports.updateMovie = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw new HttpError(404, "Movie not found");

  const d = readBody(req.body, false);
  // empty boxes in the quick form keep the saved value instead of breaking the save
  for (const k of ["description", "lang", "ageRating"]) if (d[k] === "") delete d[k];
  for (const k of ["duration", "releaseYear"]) if (d[k] !== undefined && !(d[k] > 0)) delete d[k];
  if (d.movieTitle === "") throw new HttpError(400, "Please fill: title");
  await uploadImages(req, d);
  await attachPeoplePhotos(req, d);

  // old images to delete from Bunny Storage after a successful save
  const oldImages = [];
  for (const [field] of IMAGE_FIELDS) {
    const oldId = movie[field]?.publicId;
    if (d[field]) {
      if (oldId && oldId !== d[field].publicId) oldImages.push(oldId);
    } else if (REMOVABLE_IMAGES[field] && parseBool(req.body[REMOVABLE_IMAGES[field]])) {
      if (oldId) oldImages.push(oldId);
      d[field] = { url: "", publicId: "" };
    }
  }
  const linkChanged = (k) => d[k] !== undefined && d[k] !== (movie[k] || "");

  // New video first; delete the old Bunny video only after the new one is saved
  const oldVideos = [];
  const movieFile = await readVideo(req, "movieVideoId", "movieFile", "movie");
  if (movieFile && movieFile.videoId !== movie.movieFile?.videoId) {
    if (movie.movieFile?.videoId) oldVideos.push(movie.movieFile.videoId);
    d.movieFile = movieFile;
    // a saved "custom link" plays instead of the uploaded video → a new upload replaces it,
    // unless the admin changed the link in this same save
    if (!linkChanged("customVideoUrl")) d.customVideoUrl = "";
  }
  const trailer = await readVideo(req, "trailerVideoId", "trailerFile", "trailer");
  if (trailer && trailer.videoId !== movie.trailer?.videoId) {
    if (movie.trailer?.videoId) oldVideos.push(movie.trailer.videoId);
    d.trailer = trailer;
    if (!linkChanged("customTrailerUrl")) d.customTrailerUrl = "";
  }
  if (parseBool(req.body.removeTrailer)) {
    if (movie.trailer?.videoId) oldVideos.push(movie.trailer.videoId);
    d.trailer = {};
    if (d.customTrailerUrl === undefined || isBunnyLink(d.customTrailerUrl)) d.customTrailerUrl = "";
  }
  if (d.publishStatus === true && !movie.publishStatus && !d.publishDate) {
    d.publishDate = publishDateOnPublish(d.publishDate === undefined ? movie.publishDate : null);
  }

  movie.set(d);
  // very old records may miss required fields → give them defaults instead of failing the save
  if (!movie.description) movie.description = movie.tagline || `Watch ${movie.movieTitle} on Gutargoo+.`;
  if (!movie.lang) movie.lang = "Hindi";
  if (!movie.ageRating) movie.ageRating = "U/A 13+";
  if (!movie.releaseYear) movie.releaseYear = new Date().getFullYear();
  if (!movie.duration) movie.duration = Math.max(1, Math.round((Number(movie.movieFile?.duration) || 60) / 60));
  await movie.save();
  deleteImages(oldImages, movieImageIds(movie));
  // only delete old videos that no movie or web series still uses
  for (const id of oldVideos) await deleteVideoIfUnused(id);
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
    countView(Movie, "m", movie._id, req); // once per viewer per 6 h; doesn't slow the reply
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
  for (const id of new Set([movie.movieFile?.videoId, movie.trailer?.videoId])) await deleteVideoIfUnused(id);
  deleteImages(movieImageIds(movie));
  res.json({ success: true, message: "Movie deleted" });
};

exports.togglePublish = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid movie id");
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw new HttpError(404, "Movie not found");
  movie.publishStatus = !movie.publishStatus;
  if (movie.publishStatus) movie.publishDate = publishDateOnPublish(movie.publishDate);
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
