const express = require("express");
const router = express.Router();

const {
  toggleLike,
  getMovieLikes,
  checkUserLiked,
} = require("../controllers/movieLikeController");

const { auth } = require("../middleware/authMiddleware");
const { asyncHandler: h } = require("../lib/http");

// LIKE / UNLIKE
router.post("/:movieId", auth, h(toggleLike));

// TOTAL LIKES
router.get("/:movieId", h(getMovieLikes));

// USER CHECK
router.get("/:movieId/check", auth, h(checkUserLiked));

module.exports = router;