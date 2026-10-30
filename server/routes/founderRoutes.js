// "Free Premium for the first 1000" — founding members (website offer, controlled from Admin → Home Settings).
// GET  /api/founder        → { active, limit, claimed, left, days, isFounder? }
// POST /api/founder/claim  → signed-in user takes one spot (atomic: never more than the limit)
const express = require("express");
const Setting = require("../models/Setting");
const Customer = require("../models/Customer");
const { auth, optionalAuth } = require("../middleware/authMiddleware");
const { asyncHandler: h, HttpError } = require("../lib/http");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const COUNTER = "founderCount";

async function offer() {
  const s = await Setting.findOne({ key: "home" }).lean();
  const v = s?.value || {};
  const limit = Math.max(0, Math.floor(Number(v.founderLimit ?? 1000) || 0));
  const days = Math.max(1, Math.floor(Number(v.founderDays ?? 365) || 365));
  const on = v.founderOffer !== false && limit > 0;
  const c = await Setting.findOne({ key: COUNTER }).lean();
  const claimed = Math.max(0, Number(c?.value?.n) || 0);
  return { on, limit, days, claimed };
}

router.get(
  "/",
  optionalAuth,
  h(async (req, res) => {
    const o = await offer();
    const left = Math.max(0, o.limit - o.claimed);
    let isFounder;
    if (req.user?._id) isFounder = !!(await Customer.exists({ _id: req.user._id, founder: true }));
    res.json({ success: true, data: { active: o.on && left > 0, limit: o.limit, claimed: Math.min(o.claimed, o.limit), left, days: o.days, ...(isFounder !== undefined ? { isFounder } : {}) } });
  })
);

const claimLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, key: (req) => `founder:${req.user?._id || req.ip}` });

router.post(
  "/claim",
  auth,
  claimLimit,
  h(async (req, res) => {
    const userId = req.user._id;
    const already = await Customer.findOne({ _id: userId }, "founder subscriptionExpiry").lean();
    if (already?.founder) return res.json({ success: true, message: "You're already a Founding Member", data: { founder: true, subscriptionExpiry: already.subscriptionExpiry } });
    const o = await offer();
    if (!o.on) throw new HttpError(400, "This offer has ended");
    // take one spot atomically
    await Setting.updateOne({ key: COUNTER }, { $setOnInsert: { value: { n: 0 } } }, { upsert: true });
    const spot = await Setting.findOneAndUpdate({ key: COUNTER, "value.n": { $lt: o.limit } }, { $inc: { "value.n": 1 } }, { returnDocument: "after" });
    if (!spot) throw new HttpError(400, `All ${o.limit} free spots are taken`);
    // mark the user (only once — a double tap gives the spot back)
    const marked = await Customer.findOneAndUpdate({ _id: userId, founder: { $ne: true } }, { $set: { founder: true, founderAt: new Date() } });
    if (!marked) {
      await Setting.updateOne({ key: COUNTER }, { $inc: { "value.n": -1 } });
      return res.json({ success: true, message: "You're already a Founding Member", data: { founder: true } });
    }
    // premium days on top of an active subscription, or from now
    let user;
    try {
      const cur = await Customer.findById(userId, "subscriptionExpiry subscriptionDays").lean();
      const base = cur?.subscriptionExpiry && new Date(cur.subscriptionExpiry).getTime() > Date.now() ? new Date(cur.subscriptionExpiry) : new Date();
      const expiry = new Date(base.getTime() + o.days * 24 * 60 * 60 * 1000);
      user = await Customer.findByIdAndUpdate(userId, { $set: { subscriptionExpiry: expiry, subscriptionDays: (Number(cur?.subscriptionDays) || 0) + o.days } }, { returnDocument: "after" });
    } catch (err) {
      // give the spot back so the user can try again
      await Customer.updateOne({ _id: userId }, { $set: { founder: false, founderAt: null } }).catch(() => {});
      await Setting.updateOne({ key: COUNTER }, { $inc: { "value.n": -1 } }).catch(() => {});
      throw err;
    }
    res.json({ success: true, message: "Welcome, Founding Member! Premium is on.", data: { founder: true, subscriptionExpiry: user?.subscriptionExpiry, spot: spot.value.n } });
  })
);

module.exports = router;
