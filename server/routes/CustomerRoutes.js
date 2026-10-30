const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  deleteAccount,
  getWatchlist,
  saveWatchlist,
} = require("../controllers/customerController");
const { asyncHandler: h } = require("../lib/http");

const { auth } = require("../middleware/authMiddleware");

// 🔥 customer routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.delete("/profile", auth, deleteAccount);
router.get("/watchlist", auth, h(getWatchlist));
router.put("/watchlist", auth, h(saveWatchlist));

module.exports = router;