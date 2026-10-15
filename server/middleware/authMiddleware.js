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

// App user (customer) must be logged in. Used by the mobile app.
const auth = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    const user = await Customer.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Your account has been blocked. Please contact support." });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Same as auth, but lets the request through without a user (req.user stays undefined).
const optionalAuth = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (decoded) {
      const user = await Customer.findById(decoded.id);
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
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Admin login required" });
    }
    const admin = await User.findById(decoded.id).select("-password");
    if (!admin || admin.role !== "admin") {
      // account removed or no longer an admin → treat as logged out
      return res.status(401).json({ success: false, message: "Admin login required" });
    }
    req.admin = admin;
    req.isAdmin = true;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Admin login required" });
  }
};

// Marks req.isAdmin = true when a valid admin token is sent; never blocks.
// Used on GET routes that both the app and the admin panel call.
const detectAdmin = async (req, res, next) => {
  try {
    const decoded = readToken(req);
    if (decoded) {
      const admin = await User.findById(decoded.id).select("role");
      if (admin && admin.role === "admin") req.isAdmin = true;
    }
  } catch {
    /* ignore */
  }
  next();
};

module.exports = { auth, optionalAuth, adminAuth, detectAdmin };
