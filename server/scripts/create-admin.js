// Create an admin, or reset an admin's password.
//   node scripts/create-admin.js you@example.com "StrongPassword123" "Your Name"
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

(async () => {
  const [email, password, name = "Admin"] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.log('Usage: node scripts/create-admin.js email "password (8+ chars)" "Name"');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash(password, 10);
  // find the admin whatever the capital letters in the saved email (Admin@x.com = admin@x.com)
  const lower = email.trim().toLowerCase();
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let user = await User.findOne({ email: { $regex: `^${escaped}$`, $options: "i" } });
  if (user) {
    Object.assign(user, { name, password: hash, role: "admin", passwordChangedAt: new Date() }); // old logins stop working
    await user.save();
  } else {
    user = await User.create({ name, email: lower, password: hash, role: "admin" });
  }
  console.log(`✅ Admin ready: ${user.email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
