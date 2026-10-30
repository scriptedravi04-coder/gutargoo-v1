const mongoose = require("mongoose");

// Same shape as Movie.movieFile — a video stored on Bunny Stream
const videoSchema = new mongoose.Schema(
  {
    url: String,
    videoId: String,
    hlsUrl: String,
    mp4Url: String,
    directPlayUrl: String,
    thumbnailUrl: String,
    duration: Number,
    size: Number,
    status: { type: Number, default: 2 }, // 4 = ready
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema({ url: String, publicId: String }, { _id: false });

const episodeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  episodeNumber: { type: Number, required: true },
  releaseDate: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: true },
  videoFile: videoSchema,
  customVideoUrl: { type: String, default: "" },
  trailer: videoSchema,
  thumbnail: imageSchema,
  skipIntro: {
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
  },
});

const seasonSchema = new mongoose.Schema({
  seasonNumber: { type: Number, required: true },
  title: { type: String, default: "" },
  releaseDate: Date,
  episodes: [episodeSchema],
});

const webseriesSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    genre: [String],
    lang: { type: String, default: "Hindi" },
    ageRating: { type: String, default: "" },
    imdbRating: { type: Number, default: 0 },
    releaseDate: Date,

    // "webseries" or "tvshow" — TV shows are web series shown under the TV Shows tab in the app
    contentType: { type: String, enum: ["webseries", "tvshow"], default: "webseries" },

    trailer: videoSchema,
    customTrailerUrl: { type: String, default: "" },

    thumbnail: imageSchema, // small card image
    verticalPoster: imageSchema, // portrait poster
    banner: imageSchema, // landscape banner

    castAndCrew: [{ type: mongoose.Schema.Types.ObjectId, ref: "CastAndCrew" }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    seasons: [seasonSchema],
    totalSeasons: { type: Number, default: 0 },
    totalEpisodes: { type: Number, default: 0 },

    isPublished: { type: Boolean, default: true },
    subscriptionRequired: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// keep counts and ordering correct on every save
webseriesSchema.pre("save", function () {
  this.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  this.seasons.forEach((s) => s.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber));
  this.totalSeasons = this.seasons.length;
  this.totalEpisodes = this.seasons.reduce((n, s) => n + s.episodes.length, 0);
});

webseriesSchema.index({ title: "text", description: "text" });
webseriesSchema.index({ isPublished: 1, contentType: 1 });
webseriesSchema.index({ "seasons.episodes.videoFile.videoId": 1 });

module.exports = mongoose.model("WebSeries", webseriesSchema);
