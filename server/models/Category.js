const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    categoryType: {
      type: String,
      required: true,
      enum: [ "movie", "webseries", "tvshows"],
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
