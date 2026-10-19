

const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema({
  // Basic Info
  movieTitle: { type: String, required: true },
  
  tagline: { type: String, default: "" },
  description: { type: String, required: true },
  fullStoryline: { type: String, default: "" },
  genres: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  lang: { type: String, required: true },
  selectedLanguage: { type: String, default: "" },
  duration: { type: Number, required: true },
  ageRating: { type: String, required: true },
  imdbRating: { type: Number, default: 0 },
  releaseYear: { type: Number, required: true },
  productionStudio: { type: [String], default: [] },
  countryOfOrigin: { type: [String], default: [] },
  budget: { type: String, default: "" },
  awardsAndNominations: { type: String, default: "" },

  // ─── Main Movie File ───────────────────────────────────────────────────────
  movieFile: {
    url:           { type: String, default: "" },
    videoId:       { type: String, default: "" },
    hlsUrl:        { type: String, default: "" },
    mp4Url:        { type: String, default: "" },
    directPlayUrl: { type: String, default: "" },
    thumbnailUrl:  { type: String, default: "" },
    duration:      { type: Number, default: 0 },
    size:          { type: Number, default: 0 },
    status:        { type: Number, default: 2 }, // 2 = processing, 4 = ready
  },
  customVideoUrl: { type: String, default: "" },

  // ─── Trailer ───────────────────────────────────────────────────────────────
  trailer: {
    url:           { type: String, default: "" },
    videoId:       { type: String, default: "" },
    hlsUrl:        { type: String, default: "" },
    mp4Url:        { type: String, default: "" },
    directPlayUrl: { type: String, default: "" },
    thumbnailUrl:  { type: String, default: "" },
    duration:      { type: Number, default: 0 },
    size:          { type: Number, default: 0 },
    status:        { type: Number, default: 2 },
  },
  customTrailerUrl: { type: String, default: "" },

  // Skip-intro button in the player (seconds). Used only when end > start.
  skipIntro: {
    start: { type: Number, default: 0 },
    end:   { type: Number, default: 0 },
  },
  releaseDate: { type: Date, default: null },

  // ─── Images ────────────────────────────────────────────────────────────────
  horizontalBanner: {
    url:      { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  verticalPoster: {
    url:      { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  logo: {
    url:      { type: String, default: "" },
    publicId: { type: String, default: "" },
  },

  videoQuality: { type: String, default: "Auto (Adaptive)" },
  audioFormat:  { type: String, default: "Stereo" },

  // ─── Crew (each member can have a name + photo) ────────────────────────────
  director: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },
  producer: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },
  writer: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },
  musicDirector: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },
  cinematographer: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },
  editor: {
    type: [{
      name:     { type: String, default: "" },
      imageUrl: { type: String, default: "" },
      publicId: { type: String, default: "" },
    }],
    default: [],
  },

  // ─── Cast (each member has name, character, and photo) ────────────────────
  castMembers: {
    type: [{
      name:      { type: String, default: "" },
      character: { type: String, default: "" },
      imageUrl:  { type: String, default: "" },
      publicId:  { type: String, default: "" },
    }],
    default: [],
  },

  // Audio & Subtitles
  audioTracks: { type: [String], default: [] },
  subtitles:   { type: [String], default: [] },

  // Publishing Settings
  publishStatus:        { type: Boolean, default: false },
  subscriptionRequired: { type: Boolean, default: false },
  enableAds:            { type: Boolean, default: true },
  allowDownloads:       { type: Boolean, default: false },
  featuredMovie:        { type: Boolean, default: false },

  // Vendor Info
  contentVendor: { type: String, default: "Internal" },
  vendorId:      { type: String, default: "" },
  publishDate:   { type: Date,   default: null },
  expiryDate:    { type: Date,   default: null },

  // SEO
  seoTitle:       { type: String,   default: "" },
  seoDescription: { type: String,   default: "" },
  seoKeywords:    { type: [String], default: [] },

  // Analytics
  viewCount: { type: Number,                          default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId,  ref: "User" },
}, { timestamps: true });

// ─── Virtuals ────────────────────────────────────────────────────────────────
movieSchema.virtual("streamUrl").get(function () {
  return this.movieFile?.status === 4
    ? this.movieFile?.hlsUrl
    : this.customVideoUrl || null;
});

movieSchema.virtual("trailerStreamUrl").get(function () {
  return this.trailer?.status === 4
    ? this.trailer?.hlsUrl
    : this.customTrailerUrl || null;
    
});

movieSchema.virtual("directPlay").get(function () {
  return this.movieFile?.directPlayUrl;
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
movieSchema.index({ 
  movieTitle: "text", 
  description: "text", 
  tags: "text" 
});

movieSchema.index({ publishStatus: 1, publishDate: 1 });
movieSchema.index({ featuredMovie: 1 });
movieSchema.index({ viewCount: -1 });
movieSchema.index({ releaseYear: -1 });
movieSchema.index({ genres: 1 });

module.exports = mongoose.model("Movie", movieSchema);