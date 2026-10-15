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
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { name, password: hash, role: "admin" } },
    { upsert: true, returnDocument: "after" }
  );
  console.log(`✅ Admin ready: ${user.email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
