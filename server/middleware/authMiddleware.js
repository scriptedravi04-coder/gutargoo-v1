const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const User = require("../models/User");

// Read "Bearer <token>" from the request. Returns the decoded payload or null.
const readToken = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

const isObjectIdString = (v) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

// Find the app user a token belongs to. Tokens from older app logins may carry the id under
// another key (_id / userId / customerId) or only the mobile number. A token whose id is not a
// valid Mongo id must mean "not logged in" (401) — never a database error (503).
const findCustomer = async (decoded) => {
  const raw = decoded.id ?? decoded._id ?? decoded.userId ?? decoded.customerId ?? decoded.user?._id ?? decoded.user?.id;
  const id = raw == null ? "" : String(raw);
  if (isObjectIdString(id)) return Customer.findById(id);
  let m = String(decoded.mobile ?? decoded.phone ?? decoded.user?.mobile ?? "").replace(/\D/g, "");
  if (m.length === 10) m = `91${m}`;
  if (/^91[6-9]\d{9}$/.test(m)) return Customer.findOne({ mobile: m });
  return null;
};

// App user (customer) must be logged in. Used by the mobile app.
const auth = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    const user = await findCustomer(decoded);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account has been blocked. Please contact support." });
    }
    req.user = user;
  } catch (error) {
    // database hiccup — not a logout reason (401 would log the app user out)
    console.error("Customer auth DB error:", error.message);
    return res.status(503).json({ success: false, message: "Server is busy, please try again" });
  }
  next();
};

// Same as auth, but lets the request through without a user (req.user stays undefined).
const optionalAuth = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (decoded) {
      const user = await findCustomer(decoded);
      if (user && !user.isBlocked) req.user = user;
    }
  } catch {
    /* ignore — treat as logged out */
  }
  next();
};

// Admin panel user must be logged in. Admins live in the "User" collection.
const adminAuth = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    // no token, or a token whose id isn't a Mongo id (not one of ours) → logged out, no DB lookup
    if (!decoded || !isObjectIdString(decoded.id)) {
      return res.status(401).json({ success: false, message: "Admin login required" });
    }
    const admin = await User.findById(decoded.id).select("-password");
    if (!admin || admin.role !== "admin") {
      // account removed or no longer an admin → treat as logged out
      return res.status(401).json({ success: false, message: "Admin login required" });
    }
    // password changed after this token was made → old logins stop working
    // (1 s grace because the token time "iat" is in whole seconds)
    if (admin.passwordChangedAt && decoded.iat && decoded.iat * 1000 < admin.passwordChangedAt.getTime() - 1000) {
      return res.status(401).json({ success: false, message: "Password was changed. Please log in again." });
    }
    req.admin = admin;
    req.isAdmin = true;
  } catch (error) {
    // database hiccup — not a logout reason
    return res.status(503).json({ success: false, message: "Server is busy, please try again" });
  }
  next();
};

// Marks req.isAdmin = true when a valid admin token is sent; never blocks.
// Used on GET routes that both the app and the admin panel call.
const detectAdmin = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (decoded && isObjectIdString(decoded.id)) {
      const admin = await User.findById(decoded.id).select("role passwordChangedAt");
      const revoked = admin?.passwordChangedAt && decoded.iat && decoded.iat * 1000 < admin.passwordChangedAt.getTime() - 1000;
      if (admin && admin.role === "admin" && !revoked) req.isAdmin = true;
    }
  } catch {
    /* ignore */
  }
  next();
};

module.exports = { auth, optionalAuth, adminAuth, detectAdmin };
