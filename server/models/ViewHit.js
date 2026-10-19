const mongoose = require("mongoose");

// "This viewer already counted a view for this title recently" markers (see lib/views.js).
// One row per viewer + title; MongoDB deletes it when expiresAt passes.
const viewHitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

viewHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ViewHit", viewHitSchema);
