// Old /api/public/* addresses, kept so nothing outside the app breaks. Read-only, published content only.
const router = require("express").Router();
const movies = require("../controllers/movieController");
const banners = require("../controllers/bannerController");
const categories = require("../controllers/categoryController");
const sections = require("../controllers/homeSectionController");
const { asyncHandler: h } = require("../lib/http");

router.get("/movies", h(movies.getMovies));
router.get("/movies/:id", h(movies.getMovieById));
router.get("/banners", h(banners.getBanners));
router.get("/banner/banners", h(banners.getBanners));
router.get("/category", h(categories.getCategories));
router.get("/sections", h(sections.getSectionsMobile));

module.exports = router;
