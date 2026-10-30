const mongoose = require("mongoose");

// App users (log in with mobile OTP)
const customerSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, unique: true, trim: true },
    name: { type: String, default: "" },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    lastLogin: { type: Date },
    isBlocked: { type: Boolean, default: false },
    // (field name spelling kept as-is because existing data uses it)
    isPremiusm: { type: Boolean, default: false },
    coins: { type: Number, default: 0 },
    subscriptionDays: { type: Number, default: 0 },
    subscriptionExpiry: { type: Date, default: null },
    // "Free Premium for the first N" founding members (website offer)
    founder: { type: Boolean, default: false },
    founderAt: { type: Date, default: null },
    // website "My List" (synced across devices for signed-in users)
    watchlist: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          kind: { type: String, enum: ["movie", "webseries", "tvshow"], default: "movie" },
          title: { type: String, default: "" },
          poster: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
