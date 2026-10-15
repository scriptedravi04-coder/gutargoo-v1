// Admin panel login (admins live in the "User" collection).
const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { adminAuth } = require("../middleware/authMiddleware");
const rateLimit = require("../middleware/rateLimit");
const { asyncHandler: h, HttpError, parseStr, isId } = require("../lib/http");

const signAdmin = (user) => jwt.sign({ id: user._id, role: "admin", kind: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts. Try again in 15 minutes." });

router.post(
  "/login",
  loginLimit,
  h(async (req, res) => {
    const email = parseStr(req.body.email)?.toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) throw new HttpError(400, "Email and password are required");
    const user = await User.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
    if (!user || user.role !== "admin" || !(await bcrypt.compare(password, user.password))) {
      throw new HttpError(401, "Wrong email or password");
    }
    res.json({ success: true, token: signAdmin(user), user: publicUser(user) });
  })
);

router.get("/me", adminAuth, (req, res) => res.json({ success: true, user: publicUser(req.admin) }));

router.post(
  "/change-password",
  adminAuth,
  h(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) throw new HttpError(400, "New password must be at least 8 characters");
    const user = await User.findById(req.admin._id);
    if (!(await bcrypt.compare(String(currentPassword || ""), user.password))) throw new HttpError(400, "Current password is wrong");
    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ success: true, message: "Password changed" });
  })
);

// Admins list / add / remove (only logged-in admins)
router.get(
  "/admins",
  adminAuth,
  h(async (req, res) => {
    const admins = await User.find({ role: "admin" }).select("-password").sort({ createdAt: 1 });
    res.json({ success: true, data: admins });
  })
);

const createAdmin = h(async (req, res) => {
  const name = parseStr(req.body.name) || "Admin";
  const email = parseStr(req.body.email)?.toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Valid email is required");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (await User.exists({ email })) throw new HttpError(400, "An admin with this email already exists");
  const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role: "admin" });
  res.status(201).json({ success: true, message: "Admin created", user: publicUser(user) });
});

router.post("/admins", adminAuth, createAdmin);

// Old public "register" endpoint: now only works for a logged-in admin,
// or when there are no admins at all yet (first-time setup).
router.post(
  "/register",
  h(async (req, res, next) => {
    if ((await User.countDocuments()) === 0) return createAdmin(req, res, next);
    return adminAuth(req, res, () => createAdmin(req, res, next));
  })
);

// Set a new password for another admin (e.g. they forgot theirs)
router.post(
  "/admins/:id/reset-password",
  adminAuth,
  h(async (req, res) => {
    if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
    const password = String(req.body.password || "");
    if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, "Admin not found");
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ success: true, message: `Password reset for ${user.email}` });
  })
);

router.delete(
  "/admins/:id",
  adminAuth,
  h(async (req, res) => {
    if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
    if (String(req.admin._id) === req.params.id) throw new HttpError(400, "You cannot delete your own account");
    if ((await User.countDocuments({ role: "admin" })) <= 1) throw new HttpError(400, "At least one admin is required");
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Admin removed" });
  })
);

module.exports = router;
