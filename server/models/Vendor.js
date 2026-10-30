const mongoose = require("mongoose");

// Content partners / studios who supply movies. Movies link to a vendor by vendorId.
const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    contactPerson: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    revenueShare: { type: Number, default: 0, min: 0, max: 100 }, // percent
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", vendorSchema);
