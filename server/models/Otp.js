const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, index: true },
    otp: String,
    expiresAt: Date,
    attempts: { type: Number, default: 0 }, // wrong tries; OTP is deleted after 5
  },
  { timestamps: true }
);

// MongoDB removes expired OTPs automatically
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
