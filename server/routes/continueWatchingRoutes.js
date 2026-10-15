// "Continue watching" row in the app (per logged-in user).
const router = require("express").Router();
const ContinueWatching = require("../models/ContinueWatching");
const Movie = require("../models/Movie");
const { auth } = require("../middleware/authMiddleware");
const { formatMovie } = require("../lib/format");
const { isMovieVisible } = require("../lib/visibility");
const { asyncHandler: h, HttpError, isId, parseBool, parseNum } = require("../lib/http");

router.use(auth);

// GET /api/continue-watching → [{ _id, movie, watchedTime, duration }]
router.get(
  "/",
  h(async (req, res) => {
    const rows = await ContinueWatching.find({ user: req.user._id, isCompleted: false })
      .sort({ updatedAt: -1 })
      .limit(30)
      .populate("movie");
    const data = rows
      .filter((r) => isMovieVisible(r.movie))
      .map((r) => ({
        _id: r._id,
        movie: formatMovie(r.movie),
        watchedTime: Math.round(r.watchedTime || 0),
        duration: Math.round(r.duration || 0),
        isCompleted: r.isCompleted,
        updatedAt: r.updatedAt,
      }));
    res.json({ success: true, data });
  })
);

// POST /api/continue-watching/save { movieId, watchedTime, duration, isCompleted }
router.post(
  "/save",
  h(async (req, res) => {
    const { movieId } = req.body;
    if (!isId(String(movieId || ""))) throw new HttpError(400, "Invalid movieId");
    if (!(await Movie.exists({ _id: movieId }))) {
      // episodes are not tracked yet — accept quietly so the app doesn't show an error
      return res.json({ success: true, message: "Not a movie; progress not stored" });
    }
    const watchedTime = Math.max(0, parseNum(req.body.watchedTime, 0));
    const duration = Math.max(0, parseNum(req.body.duration, 0));
    const isCompleted = parseBool(req.body.isCompleted, false) || (duration > 0 && watchedTime / duration >= 0.95);
    const row = await ContinueWatching.findOneAndUpdate(
      { user: req.user._id, movie: movieId },
      { watchedTime, duration, isCompleted },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: "Progress saved", data: row });
  })
);

// DELETE /api/continue-watching/:movieId
router.delete(
  "/:movieId",
  h(async (req, res) => {
    if (!isId(req.params.movieId)) throw new HttpError(400, "Invalid movieId");
    await ContinueWatching.deleteOne({ user: req.user._id, movie: req.params.movieId });
    res.json({ success: true, message: "Removed" });
  })
);

module.exports = router;
