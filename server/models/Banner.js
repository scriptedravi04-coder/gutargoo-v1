const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    logoImage: { url: String, publicId: String },
    bannerImage: { url: String, publicId: String },
    // optional tall picture for the website on phones (the app always uses bannerImage)
    mobileImage: { url: String, publicId: String },

    // What the banner opens in the app
    bannerType: { type: String, enum: ["single_movie", "web_series"], default: "single_movie" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", default: null },
    webseriesId: { type: mongoose.Schema.Types.ObjectId, ref: "WebSeries", default: null },

    displayOrder: { type: Number, default: 0 },
    visibleOn: { type: String, enum: ["home", "category", "movie", "all"], default: "home" },
    publishStatus: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bannerSchema.index({ publishStatus: 1, displayOrder: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
