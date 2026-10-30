const mongoose = require("mongoose");

// Request counters for the rate limiter, shared by all server instances (Cloud Run).
// One row per limiter + visitor + time window; MongoDB deletes it when the window ends.
const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RateLimit", rateLimitSchema);
