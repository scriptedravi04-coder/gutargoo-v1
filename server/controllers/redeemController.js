// Redeem codes: admin creates them, app users apply them.
const RedeemCode = require("../models/RedeemCode");
const Customer = require("../models/Customer");
const { HttpError, isId, parseBool, parseNum, parseStr, parseDate } = require("../lib/http");

const TYPES = ["coins", "subscription", "premium"];
const DAY = 24 * 60 * 60 * 1000;

const rewardText = (c) =>
  c.type === "coins"
    ? `${c.value} coins`
    : c.type === "subscription"
    ? `${c.value} days subscription`
    : c.value
    ? `Premium for ${c.value} days`
    : "Premium";

const readCode = (b) => {
  const d = {};
  if (b.code !== undefined) d.code = parseStr(b.code)?.toUpperCase().replace(/\s+/g, "");
  if (b.description !== undefined) d.description = parseStr(b.description);
  if (b.type !== undefined) d.type = parseStr(b.type);
  if (b.value !== undefined) d.value = Math.max(0, parseNum(b.value, 0));
  if (b.expiryDate !== undefined) d.expiryDate = parseDate(b.expiryDate);
  if (b.maxUses !== undefined) d.maxUses = Math.max(1, parseNum(b.maxUses, 1));
  if (b.showInApp !== undefined) d.showInApp = parseBool(b.showInApp, true);
  if (b.isActive !== undefined) d.isActive = parseBool(b.isActive, true);
  return d;
};

/* ───────── Admin ───────── */

exports.createRedeemCode = async (req, res) => {
  const d = readCode(req.body);
  if (!d.code || d.code.length < 3) throw new HttpError(400, "Code must be at least 3 characters");
  if (!TYPES.includes(d.type)) throw new HttpError(400, "Type must be coins, subscription or premium");
  if (!d.expiryDate) throw new HttpError(400, "Expiry date is required");
  if ((d.type === "coins" || d.type === "subscription") && !d.value) throw new HttpError(400, "Value is required");
  if (await RedeemCode.exists({ code: d.code })) throw new HttpError(400, "This code already exists");
  const code = await RedeemCode.create(d);
  res.status(201).json({ success: true, message: "Redeem code created", data: code });
};

exports.updateRedeemCode = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const d = readCode(req.body);
  delete d.code; // code text can't change after users may have it
  if (d.type && !TYPES.includes(d.type)) throw new HttpError(400, "Type must be coins, subscription or premium");
  const code = await RedeemCode.findByIdAndUpdate(req.params.id, d, { returnDocument: "after", runValidators: true });
  if (!code) throw new HttpError(404, "Code not found");
  res.json({ success: true, message: "Redeem code updated", data: code });
};

exports.getAllCodes = async (req, res) => {
  const codes = await RedeemCode.find().sort({ createdAt: -1 }).lean();
  res.json({
    success: true,
    data: codes.map((c) => ({ ...c, usersUsed: undefined, usersCount: (c.usersUsed || []).length, reward: rewardText(c) })),
  });
};

exports.deleteCode = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const code = await RedeemCode.findByIdAndDelete(req.params.id);
  if (!code) throw new HttpError(404, "Code not found");
  res.json({ success: true, message: "Code deleted" });
};

/* ───────── App ───────── */

// GET /api/redeem/list — codes the logged-in user can see in the app
exports.getAvailableCodes = async (req, res) => {
  const codes = await RedeemCode.find({ isActive: true, showInApp: { $ne: false }, expiryDate: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  const userId = String(req.user._id);
  res.json({
    success: true,
    data: codes
      .filter((c) => c.usedCount < c.maxUses || (c.usersUsed || []).some((u) => String(u) === userId))
      .map((c) => ({
        _id: c._id,
        code: c.code,
        description: c.description || rewardText(c),
        reward: rewardText(c),
        type: c.type,
        value: c.value,
        expiryDate: c.expiryDate,
        expiresAt: c.expiryDate,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        isUsed: (c.usersUsed || []).some((u) => String(u) === userId),
      })),
  });
};

// POST /api/redeem { code }
exports.redeemCode = async (req, res) => {
  const text = parseStr(req.body.code)?.toUpperCase().replace(/\s+/g, "");
  if (!text) throw new HttpError(400, "Code is required");

  const found = await RedeemCode.findOne({ code: text });
  if (!found || !found.isActive) throw new HttpError(400, "Invalid code");
  if (new Date() > found.expiryDate) throw new HttpError(400, "This code has expired");
  if (found.usersUsed.some((u) => String(u) === String(req.user._id))) throw new HttpError(400, "You have already used this code");

  // claim one use atomically (stops two people taking the last use at the same time)
  const claimed = await RedeemCode.findOneAndUpdate(
    { _id: found._id, $expr: { $lt: ["$usedCount", "$maxUses"] }, usersUsed: { $ne: req.user._id } },
    { $inc: { usedCount: 1 }, $addToSet: { usersUsed: req.user._id } },
    { returnDocument: "after" }
  );
  if (!claimed) throw new HttpError(400, "This code has been fully used");

  // give the reward with atomic updates (two codes at once can't overwrite each other)
  let user;
  try {
    if (claimed.type === "coins") {
      user = await Customer.findByIdAndUpdate(req.user._id, { $inc: { coins: claimed.value } }, { returnDocument: "after" });
    } else if (claimed.type === "premium" && !claimed.value) {
      user = await Customer.findByIdAndUpdate(req.user._id, { $set: { isPremiusm: true } }, { returnDocument: "after" });
    } else {
      // add days on top of an active subscription, or from now
      user = await Customer.findByIdAndUpdate(
        req.user._id,
        [
          {
            $set: {
              subscriptionExpiry: {
                $dateAdd: {
                  startDate: { $cond: [{ $gt: ["$subscriptionExpiry", "$$NOW"] }, "$subscriptionExpiry", "$$NOW"] },
                  unit: "day",
                  amount: claimed.value,
                },
              },
              subscriptionDays: { $add: [{ $ifNull: ["$subscriptionDays", 0] }, claimed.value] },
            },
          },
        ],
        { returnDocument: "after", updatePipeline: true }
      );
    }
  } catch (err) {
    // give the use back if the reward could not be saved
    await RedeemCode.updateOne({ _id: claimed._id }, { $inc: { usedCount: -1 }, $pull: { usersUsed: req.user._id } });
    throw err;
  }

  res.json({
    success: true,
    message: `Code applied: ${rewardText(claimed)}`,
    type: claimed.type,
    value: claimed.value,
    data: {
      coins: user.coins,
      isPremium: user.isPremiusm || (user.subscriptionExpiry && user.subscriptionExpiry > new Date()),
      subscriptionExpiry: user.subscriptionExpiry,
    },
  });
};
