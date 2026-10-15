const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  deleteAccount,
} = require("../controllers/customerController");

const { auth } = require("../middleware/authMiddleware");

// 🔥 customer routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.delete("/profile", auth, deleteAccount);

module.exports = router;