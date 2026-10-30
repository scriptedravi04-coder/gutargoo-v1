const mongoose = require("mongoose");

const homeSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // Hand-picked items (used when contentSource is "admin_selected", or "auto" with items)
    sectionData: {
      movies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
      webseries: [{ type: mongoose.Schema.Types.ObjectId, ref: "WebSeries" }],
    },

    // Where the items come from:
    //  admin_selected → the hand-picked list above
    //  recently_added → newest content
    //  most_viewed    → highest view count
    //  watch_time_based → most watched in the last `trendingPeriodDays` days
    //  auto           → hand-picked list if any, otherwise newest
    contentSource: {
      type: String,
      enum: ["auto", "most_viewed", "recently_added", "watch_time_based", "admin_selected"],
      default: "admin_selected",
    },

    // Optional: limits automatic sections to one category type (Movies / Web Series / TV Shows)
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },

    displayStyle: {
      type: String,
      enum: ["horizontal_banner", "vertical_banner", "big_horizontal", "big_vertical", "index_horizontal", "index_vertical"],
      default: "vertical_banner",
    },
    itemLimit: { type: Number, default: 20, min: 1, max: 50 },
    isActive: { type: Boolean, default: true },
    isOriginalOnly: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0, index: true },
    trendingPeriodDays: { type: Number, default: 7 },
    sortConfig: {
      field: { type: String, default: "views" },
      order: { type: String, enum: ["asc", "desc"], default: "desc" },
    },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeSection", homeSectionSchema);
