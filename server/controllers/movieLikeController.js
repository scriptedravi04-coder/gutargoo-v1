// Movie likes (one row per user + movie). Errors go to the shared error handler.
const MovieLike = require("../models/MovieLike");
const Movie = require("../models/Movie");
const { HttpError, isId } = require("../lib/http");

const readMovieId = (req) => {
  const movieId = req.params.movieId;
  if (!isId(movieId)) throw new HttpError(400, "Invalid movie id");
  return movieId;
};

// LIKE / UNLIKE
exports.toggleLike = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) throw new HttpError(401, "Unauthorized");
  const movieId = readMovieId(req);

  // already liked → this removes it (one atomic step, no read-then-write race)
  const removed = await MovieLike.deleteOne({ userId, movieId });
  if (removed.deletedCount > 0) {
    return res.json({ success: true, message: "Unliked", liked: false });
  }

  if (!(await Movie.exists({ _id: movieId }))) throw new HttpError(404, "Movie not found");

  // upsert: a double tap can't create a duplicate (no duplicate-key error)
  try {
    await MovieLike.updateOne({ userId, movieId }, { $setOnInsert: { userId, movieId } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err; // the other tap already saved it
  }
  res.json({ success: true, message: "Liked", liked: true });
};

// TOTAL LIKES COUNT
exports.getMovieLikes = async (req, res) => {
  const movieId = readMovieId(req);
  const count = await MovieLike.countDocuments({ movieId });
  res.json({ success: true, totalLikes: count });
};

// CHECK USER LIKED OR NOT
exports.checkUserLiked = async (req, res) => {
  const movieId = readMovieId(req);
  const liked = await MovieLike.exists({ userId: req.user._id, movieId });
  res.json({ success: true, liked: !!liked });
};
