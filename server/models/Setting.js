const mongoose = require("mongoose");

// Key/value app settings edited from the admin panel (e.g. key "home").
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
