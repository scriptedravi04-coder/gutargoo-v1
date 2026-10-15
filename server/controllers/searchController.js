// GET /api/search?query=  (also accepts ?q=) — searches published movies by title, description and tags.
const Movie = require("../models/Movie");
const { formatMovie } = require("../lib/format");
const { visibleMovieQuery } = require("../lib/visibility");
const { HttpError, paging, escapeRegex } = require("../lib/http");

const searchMovies = async (req, res) => {
  const text = String(req.query.query || req.query.q || "").trim().slice(0, 100);
  if (!text) throw new HttpError(400, "Search query required");
  const { page, limit, skip } = paging(req.query, 10);

  // text index first (best match order); fall back to "contains" for partial words
  let q = { ...visibleMovieQuery(), $text: { $search: text } };
  let total = await Movie.countDocuments(q);
  let cursor = Movie.find(q, { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } });
  if (!total) {
    q = { ...visibleMovieQuery(), movieTitle: { $regex: escapeRegex(text), $options: "i" } };
    total = await Movie.countDocuments(q);
    cursor = Movie.find(q).sort({ viewCount: -1 });
  }
  const movies = await cursor.skip(skip).limit(limit);
  res.json({
    success: true,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    data: movies.map((m) => formatMovie(m)),
  });
};

module.exports = { searchMovies };
