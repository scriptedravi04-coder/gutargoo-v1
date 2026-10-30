const mongoose = require("mongoose");

// Image popup shown when the app opens. App reads GET /api/popups (one active popup).
const popupSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    image: { url: String, publicId: String },
    link: { type: String, default: "" }, // optional, for future use in the app
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Popup", popupSchema);
