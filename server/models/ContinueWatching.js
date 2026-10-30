const mongoose = require("mongoose");

// Where each app user stopped watching each movie.
const continueWatchingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
    watchedTime: { type: Number, default: 0 }, // seconds
    duration: { type: Number, default: 0 }, // seconds
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

continueWatchingSchema.index({ user: 1, movie: 1 }, { unique: true });
continueWatchingSchema.index({ user: 1, updatedAt: -1 });
// home "most watched" looks at recent rows of all users
continueWatchingSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("ContinueWatching", continueWatchingSchema);
