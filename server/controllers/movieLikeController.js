const MovieLike = require("../models/MovieLike");

// LIKE / UNLIKE
exports.toggleLike = async (req, res) => {
  try {
    const userId = req.user?.id;
    const movieId = req.params.movieId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const existing = await MovieLike.findOne({ userId, movieId });

    if (existing) {
      // UNLIKE
      await MovieLike.deleteOne({ _id: existing._id });

      return res.json({
        success: true,
        message: "Unliked",
        liked: false,
      });
    }

    // LIKE
    await MovieLike.create({ userId, movieId });

    res.json({
      success: true,
      message: "Liked",
      liked: true,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// TOTAL LIKES COUNT
exports.getMovieLikes = async (req, res) => {
  try {
    const movieId = req.params.movieId;

    const count = await MovieLike.countDocuments({ movieId });

    res.json({
      success: true,
      totalLikes: count,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// CHECK USER LIKED OR NOT
exports.checkUserLiked = async (req, res) => {
  try {
    const userId = req.user?.id;
    const movieId = req.params.movieId;

    const liked = await MovieLike.exists({ userId, movieId });

    res.json({
      success: true,
      liked: !!liked,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};