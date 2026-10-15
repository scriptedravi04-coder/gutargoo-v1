const mongoose = require("mongoose");

const redeemCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    // coins → adds `value` coins · subscription → adds `value` days · premium → premium on (value = days, 0 = forever)
    type: { type: String, enum: ["coins", "subscription", "premium"], required: true },
    value: { type: Number, default: 0 },
    expiryDate: { type: Date, required: true },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    usersUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: "Customer" }],
    showInApp: { type: Boolean, default: true }, // listed in the app's redeem screen
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

redeemCodeSchema.index({ isActive: 1, expiryDate: 1 });

module.exports = mongoose.model("RedeemCode", redeemCodeSchema);
