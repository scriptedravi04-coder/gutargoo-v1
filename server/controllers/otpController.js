// App login with mobile number + OTP (SMS).
const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp");
const Customer = require("../models/Customer");
const { HttpError, parseStr } = require("../lib/http");

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_WRONG_TRIES = 5;
const TOKEN_DAYS = parseInt(process.env.CUSTOMER_TOKEN_DAYS, 10) || 180;

// "9876543210" or "919876543210" or "+91 98765 43210" → "919876543210"
const normalizeMobile = (raw) => {
  let m = String(raw || "").replace(/\D/g, "");
  if (m.length === 12 && m.startsWith("91")) m = m.slice(2);
  if (!/^[6-9]\d{9}$/.test(m)) return null;
  return `91${m}`;
};

// Optional test login for App Store / Play Store reviewers (no SMS is sent).
// Set OTP_TEST_MOBILE=9999999999 and OTP_TEST_CODE=123456 in .env to enable.
const testLogin = (mobile) => {
  const testMobile = normalizeMobile(process.env.OTP_TEST_MOBILE);
  const code = (process.env.OTP_TEST_CODE || "").trim();
  return testMobile && code && mobile === testMobile ? code : null;
};

exports.normalizeMobile = normalizeMobile;

// Older records may store the number as "9876543210" or "+919876543210" instead of "919876543210".
// Find whichever one exists so a returning user keeps their account (no duplicate).
const mobileVariants = (mobile) => {
  const ten = mobile.slice(2);
  return [mobile, ten, `+${mobile}`];
};
const findExistingCustomer = (mobile, projection) =>
  Customer.findOne({ mobile: { $in: mobileVariants(mobile) } }, projection).sort({ createdAt: 1 });

exports.sendOtp = async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  if (!mobile) throw new HttpError(400, "Please enter a valid 10-digit mobile number");

  const blocked = await Customer.exists({ mobile: { $in: mobileVariants(mobile) }, isBlocked: true });
  if (blocked) throw new HttpError(403, "This number has been blocked. Please contact support.");

  const testCode = testLogin(mobile);
  const otp = testCode || String(crypto.randomInt(100000, 1000000));
  await Otp.deleteMany({ mobile });
  await Otp.create({ mobile, otp, expiresAt: new Date(Date.now() + OTP_TTL_MS) });

  if (!testCode) {
    // DLT template — the text must match the registered template exactly
    const message = `Your One Time Password (OTP) is ${otp} for Gutargoo+ app login. Do not share it with anyone. Valid till 5 minutes.www.gutargooplus.com`;
    const params = new URLSearchParams({
      user: process.env.SMS_USER || "",
      authkey: process.env.SMS_AUTH_KEY || "",
      type: "1",
      sender: process.env.SMS_SENDER || "",
      mobile,
      text: message,
      templateid: process.env.SMS_TEMPLATE_ID || "",
    });
    try {
      await axios.get(`${process.env.SMS_BASE_URL}?${params.toString()}`, { timeout: 15000 });
    } catch (err) {
      console.error("SMS send failed:", err.response?.status || err.message);
      throw new HttpError(502, "Could not send OTP right now. Please try again.");
    }
  }
  res.json({ success: true, message: "OTP sent successfully" });
};

exports.verifyOtp = async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const otp = parseStr(req.body.otp);
  if (!mobile || !otp) return res.status(400).json({ success: false, message: "Mobile and OTP required" });

  const record = await Otp.findOne({ mobile }).sort({ createdAt: -1 });
  if (!record || record.expiresAt < new Date() || record.attempts >= MAX_WRONG_TRIES) {
    return res.json({ success: false, message: "OTP expired. Please request a new one." });
  }
  const a = Buffer.from(record.otp);
  const b = Buffer.from(otp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    // count the wrong try atomically so parallel guesses can't get extra tries
    const updated = await Otp.findOneAndUpdate(
      { _id: record._id, attempts: { $lt: MAX_WRONG_TRIES } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );
    if (!updated || updated.attempts >= MAX_WRONG_TRIES) {
      await Otp.deleteMany({ mobile });
      return res.json({ success: false, message: "Too many wrong attempts. Please request a new OTP." });
    }
    return res.json({ success: false, message: "Invalid OTP" });
  }
  // use the OTP up atomically: only one of two parallel requests (double tap) can win it
  const consumed = await Otp.findOneAndDelete({
    _id: record._id,
    otp: record.otp,
    attempts: { $lt: MAX_WRONG_TRIES },
    expiresAt: { $gt: new Date() },
  });
  if (!consumed) return res.json({ success: false, message: "OTP expired. Please request a new one." });
  await Otp.deleteMany({ mobile });

  // an old account saved with another number format → use that one (prefer the "91…" record if both exist)
  const existing = (await Customer.findOne({ mobile }, "_id")) || (await findExistingCustomer(mobile, "_id"));
  // create-or-update in one step (no duplicate-key error if two logins race)
  const upsert = () =>
    Customer.findOneAndUpdate(
      existing ? { _id: existing._id } : { mobile },
      { $set: { lastLogin: new Date() }, $setOnInsert: { role: "customer" } },
      { upsert: !existing, returnDocument: "after", setDefaultsOnInsert: true }
    );
  let customer;
  try {
    customer = await upsert();
  } catch (err) {
    if (err.code !== 11000) throw err;
    customer = await upsert(); // the other request just created it → now it's an update
  }
  if (!customer) throw new HttpError(503, "Please try again"); // the old record was removed at this exact moment
  if (customer.isBlocked) return res.status(403).json({ success: false, message: "This number has been blocked. Please contact support." });

  const token = jwt.sign({ id: customer._id, role: "customer" }, process.env.JWT_SECRET, { expiresIn: `${TOKEN_DAYS}d` });
  // the app shows "+91 " + user.mobile → send the 10 digits; mobileFull keeps the "91…" form
  res.json({ success: true, message: "OTP Verified", token, user: { mobile: mobile.slice(2), mobileFull: mobile } });
};
