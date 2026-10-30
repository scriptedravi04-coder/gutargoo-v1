const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" },
  // set when the password changes → admin tokens issued before this stop working
  passwordChangedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);