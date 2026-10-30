const mongoose = require("mongoose");

// Subscription plans. Public list: GET /api/plans
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // rupees
    originalPrice: { type: Number, default: 0 }, // for "strike-through" price
    durationDays: { type: Number, required: true, min: 1 },
    features: { type: [String], default: [] },
    googlePlayProductId: { type: String, default: "" },
    appleProductId: { type: String, default: "" },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubscriptionPlan", planSchema);
