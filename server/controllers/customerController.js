const Customer = require("../models/Customer");
const ContinueWatching = require("../models/ContinueWatching");
const MovieLike = require("../models/MovieLike");


// ✅ GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const user = await Customer.findById(req.user._id).select("-__v -watchlist");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });

  } catch (error) {
    console.log("❌ GET PROFILE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};


// ✅ UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : undefined;

    const user = await Customer.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔥 optional update
    // mobile number can only change by logging in with OTP, never here
    if (name !== undefined) user.name = name;

    await user.save();

    return res.json({
      success: true,
      message: "Profile updated",
      data: (({ watchlist, __v, ...rest }) => rest)(user.toObject()),
    });

  } catch (error) {
    console.log("❌ UPDATE PROFILE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
};


// ✅ DELETE ACCOUNT
exports.deleteAccount = async (req, res) => {
  try {
    const user = await Customer.findByIdAndDelete(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // remove this user's watch history and likes too (redeem codes keep the mobile number, so codes can't be reused)
    await Promise.all([
      ContinueWatching.deleteMany({ user: user._id }),
      MovieLike.deleteMany({ userId: user._id }),
    ]);

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });

  } catch (error) {
    console.log("❌ DELETE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};

// ✅ MY LIST (website) — GET returns the saved list, PUT replaces it
const cleanList = (raw) => {
  const seen = new Set();
  const out = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const id = String(x?.id || "").trim();
    if (!/^[a-f0-9]{24}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: ["movie", "webseries", "tvshow"].includes(x.kind) ? x.kind : "movie",
      title: String(x.title || "").slice(0, 200),
      poster: String(x.poster || "").slice(0, 1000),
    });
    if (out.length >= 300) break;
  }
  return out;
};
exports.getWatchlist = async (req, res) => {
  const user = await Customer.findById(req.user._id, "watchlist").lean();
  res.json({ success: true, data: user?.watchlist || [] });
};
exports.saveWatchlist = async (req, res) => {
  const list = cleanList(req.body?.items);
  await Customer.updateOne({ _id: req.user._id }, { $set: { watchlist: list } });
  res.json({ success: true, data: list });
};
