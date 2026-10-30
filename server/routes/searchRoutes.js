const express = require("express");
const router = express.Router();

const {searchMovies} = require("../controllers/searchController");

router.get("/search", searchMovies);

module.exports = router;
