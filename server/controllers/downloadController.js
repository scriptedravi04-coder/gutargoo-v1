// GET /api/download/:id — the app asks for a direct MP4 link to save a movie/episode offline.
// The app expects { success: true, url } and treats message "Stream URL not available" as "still processing".
const Movie = require("../models/Movie");
const WebSeries = require("../models/webseries");
const bunny = require("../services/bunnyService");
const { HttpError, isId } = require("../lib/http");
const { isMovieVisible } = require("../lib/visibility");

exports.getDownloadUrl = async (req, res) => {
  const { videoId: id } = req.params;
  if (!isId(id)) throw new HttpError(400, "Invalid video ID");

  let bunnyId = null;
  const movie = await Movie.findById(id, "publishStatus publishDate expiryDate allowDownloads movieFile");
  if (movie) {
    if (!isMovieVisible(movie)) throw new HttpError(403, "Movie not available");
    if (!movie.allowDownloads) throw new HttpError(403, "Download not allowed for this movie");
    bunnyId = movie.movieFile?.videoId;
  } else {
    // maybe an episode id
    const series = await WebSeries.findOne({ "seasons.episodes._id": id }, "isPublished seasons");
    if (!series || series.isPublished === false) throw new HttpError(404, "Video not found");
    for (const s of series.seasons) {
      const ep = s.episodes.id(id);
      if (ep && ep.isPublished !== false) bunnyId = ep.videoFile?.videoId;
    }
  }

  if (!bunnyId) return res.status(400).json({ success: false, message: "Stream URL not available" });
  const url = await bunny.mp4DownloadUrl(bunnyId);
  if (!url) return res.status(400).json({ success: false, message: "Stream URL not available" });
  res.json({ success: true, url });
};
