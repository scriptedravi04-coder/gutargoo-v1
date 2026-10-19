const mongoose = require("mongoose");

const movieLikeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Movie",
    required: true,
  },
}, { timestamps: true });

// Ek user ek movie ko ek hi baar like kare
movieLikeSchema.index({ userId: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model("MovieLike", movieLikeSchema);