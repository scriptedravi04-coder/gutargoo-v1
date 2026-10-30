const mongoose = require("mongoose");

// Video ads (VAST) shown in the app's player. App reads GET /api/ads/all.
const adSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    vastUrl: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    // start | mid | end | custom (at `showAt` seconds) | multiple (at each of `multiplePositions` seconds)
    positionType: { type: String, enum: ["start", "mid", "end", "custom", "multiple"], default: "start" },
    showAt: { type: Number, default: 0 }, // seconds, for "custom"
    duration: { type: Number, default: 0 }, // seconds (0 = as long as the ad)
    showAtStart: { type: Boolean, default: false },
    showAtMid: { type: Boolean, default: false },
    showAtEnd: { type: Boolean, default: false },
    multiplePositions: { type: [Number], default: [] },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ad", adSchema);
