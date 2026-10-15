const express = require("express");
const router = express.Router();

const {
  toggleLike,
  getMovieLikes,
  checkUserLiked,
} = require("../controllers/movieLikeController");

const { auth } = require("../middleware/authMiddleware");

// LIKE / UNLIKE
router.post("/:movieId", auth, toggleLike);

// TOTAL LIKES
router.get("/:movieId", getMovieLikes);

// USER CHECK
router.get("/:movieId/check", auth, checkUserLiked);

module.exports = router;