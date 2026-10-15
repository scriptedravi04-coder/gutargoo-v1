// Ads, popup, subscription plans, vendors and app settings.
// Public GETs are what the app reads; everything else is admin-only.
const express = require("express");
const Ad = require("../models/Ad");
const Popup = require("../models/Popup");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const Vendor = require("../models/Vendor");
const Setting = require("../models/Setting");
const bunny = require("../services/bunnyService");
const upload = require("../lib/upload");
const { adminAuth } = require("../middleware/authMiddleware");
const { uploadImageFile, firstFile } = require("../lib/media");
const { asyncHandler: h, HttpError, isId, parseBool, parseNum, parseStr, parseArray } = require("../lib/http");

const byId = async (Model, id, label) => {
  if (!isId(id)) throw new HttpError(400, "Invalid id");
  const doc = await Model.findById(id);
  if (!doc) throw new HttpError(404, `${label} not found`);
  return doc;
};

/* ───────── Ads (VAST) ───────── */
const ads = express.Router();
const POSITIONS = ["start", "mid", "end", "custom", "multiple"];

const readAd = (b) => {
  const d = {};
  if (b.title !== undefined) d.title = parseStr(b.title);
  if (b.vastUrl !== undefined) d.vastUrl = parseStr(b.vastUrl);
  if (b.isActive !== undefined) d.isActive = parseBool(b.isActive, true);
  if (b.positionType !== undefined) d.positionType = POSITIONS.includes(b.positionType) ? b.positionType : "start";
  if (b.showAt !== undefined) d.showAt = Math.max(0, parseNum(b.showAt, 0));
  if (b.duration !== undefined) d.duration = Math.max(0, parseNum(b.duration, 0));
  for (const k of ["showAtStart", "showAtMid", "showAtEnd"]) if (b[k] !== undefined) d[k] = parseBool(b[k], false);
  if (b.multiplePositions !== undefined) d.multiplePositions = parseArray(b.multiplePositions).map(Number).filter((n) => n >= 0);
  if (b.displayOrder !== undefined) d.displayOrder = parseNum(b.displayOrder, 0);
  // keep the start/mid/end flags in line with the chosen position
  if (d.positionType === "start") Object.assign(d, { showAtStart: true, showAtMid: false, showAtEnd: false });
  if (d.positionType === "mid") Object.assign(d, { showAtStart: false, showAtMid: true, showAtEnd: false });
  if (d.positionType === "end") Object.assign(d, { showAtStart: false, showAtMid: false, showAtEnd: true });
  return d;
};
const validVast = (u) => /^https?:\/\/\S+$/i.test(u || "");

ads.get("/all", h(async (req, res) => {
  const data = await Ad.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 }).lean();
  res.json({ success: true, count: data.length, data });
}));
ads.get("/", adminAuth, h(async (req, res) => {
  const data = await Ad.find({}).sort({ displayOrder: 1, createdAt: 1 });
  res.json({ success: true, count: data.length, data });
}));
ads.post("/", adminAuth, h(async (req, res) => {
  const d = readAd(req.body);
  if (!validVast(d.vastUrl)) throw new HttpError(400, "A valid VAST tag URL (https://…) is required");
  const ad = await Ad.create(d);
  res.status(201).json({ success: true, message: "Ad created", data: ad });
}));
ads.put("/:id", adminAuth, h(async (req, res) => {
  const ad = await byId(Ad, req.params.id, "Ad");
  const d = readAd(req.body);
  if (d.vastUrl !== undefined && !validVast(d.vastUrl)) throw new HttpError(400, "A valid VAST tag URL (https://…) is required");
  ad.set(d);
  await ad.save();
  res.json({ success: true, message: "Ad updated", data: ad });
}));
ads.delete("/:id", adminAuth, h(async (req, res) => {
  const ad = await byId(Ad, req.params.id, "Ad");
  await ad.deleteOne();
  res.json({ success: true, message: "Ad deleted" });
}));

/* ───────── Popup ───────── */
const popups = express.Router();
const popupImage = upload.images(["image"]);
const formatPopup = (p) => {
  const o = p.toObject ? p.toObject() : p;
  return { ...o, image: o.image?.url || "" };
};

// App: the newest active popup (or null)
popups.get("/", h(async (req, res) => {
  const p = await Popup.findOne({ isActive: true, "image.url": { $nin: [null, ""] } }).sort({ updatedAt: -1 });
  res.json({ success: true, data: p ? formatPopup(p) : null });
}));
popups.get("/admin/all", adminAuth, h(async (req, res) => {
  const list = await Popup.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: list.map(formatPopup) });
}));
const savePopup = async (req, popup) => {
  if (req.body.title !== undefined) popup.title = parseStr(req.body.title);
  if (req.body.link !== undefined) popup.link = parseStr(req.body.link);
  if (req.body.isActive !== undefined) popup.isActive = parseBool(req.body.isActive, false);
  const img = await uploadImageFile(firstFile(req, "image"), "popup");
  const old = img ? popup.image?.publicId : null;
  if (img) popup.image = img;
  if (!popup.image?.url) throw new HttpError(400, "Popup image is required");
  await popup.save();
  if (old) bunny.deleteImage(old);
  // only one popup can be live at a time
  if (popup.isActive) await Popup.updateMany({ _id: { $ne: popup._id } }, { isActive: false });
  return popup;
};
popups.post("/", adminAuth, popupImage, h(async (req, res) => {
  const p = await savePopup(req, new Popup());
  res.status(201).json({ success: true, message: "Popup created", data: formatPopup(p) });
}));
popups.put("/:id", adminAuth, popupImage, h(async (req, res) => {
  const p = await savePopup(req, await byId(Popup, req.params.id, "Popup"));
  res.json({ success: true, message: "Popup updated", data: formatPopup(p) });
}));
popups.delete("/:id", adminAuth, h(async (req, res) => {
  const p = await byId(Popup, req.params.id, "Popup");
  await p.deleteOne();
  bunny.deleteImage(p.image?.publicId);
  res.json({ success: true, message: "Popup deleted" });
}));

/* ───────── Subscription plans ───────── */
const plans = express.Router();
const readPlan = (b) => {
  const d = {};
  for (const k of ["name", "googlePlayProductId", "appleProductId"]) if (b[k] !== undefined) d[k] = parseStr(b[k]);
  for (const k of ["price", "originalPrice", "durationDays", "displayOrder"]) if (b[k] !== undefined) d[k] = parseNum(b[k], 0);
  for (const k of ["isPopular", "isActive"]) if (b[k] !== undefined) d[k] = parseBool(b[k], false);
  if (b.features !== undefined) d.features = parseArray(b.features).map(String).filter(Boolean);
  return d;
};
plans.get("/", h(async (req, res) => {
  const data = await SubscriptionPlan.find({ isActive: true }).sort({ displayOrder: 1, price: 1 });
  res.json({ success: true, data });
}));
plans.get("/admin/all", adminAuth, h(async (req, res) => {
  const data = await SubscriptionPlan.find({}).sort({ displayOrder: 1, price: 1 });
  res.json({ success: true, data });
}));
plans.post("/", adminAuth, h(async (req, res) => {
  const d = readPlan(req.body);
  if (!d.name || d.price === undefined || !d.durationDays) throw new HttpError(400, "Name, price and duration are required");
  const plan = await SubscriptionPlan.create(d);
  res.status(201).json({ success: true, message: "Plan created", data: plan });
}));
plans.put("/:id", adminAuth, h(async (req, res) => {
  const plan = await byId(SubscriptionPlan, req.params.id, "Plan");
  plan.set(readPlan(req.body));
  await plan.save();
  res.json({ success: true, message: "Plan updated", data: plan });
}));
plans.delete("/:id", adminAuth, h(async (req, res) => {
  const plan = await byId(SubscriptionPlan, req.params.id, "Plan");
  await plan.deleteOne();
  res.json({ success: true, message: "Plan deleted" });
}));

/* ───────── Vendors ───────── */
const vendors = express.Router();
vendors.use(adminAuth);
const readVendor = (b) => {
  const d = {};
  for (const k of ["name", "contactPerson", "email", "phone", "notes"]) if (b[k] !== undefined) d[k] = parseStr(b[k]);
  if (b.revenueShare !== undefined) d.revenueShare = Math.min(100, Math.max(0, parseNum(b.revenueShare, 0)));
  if (b.status !== undefined) d.status = b.status === "inactive" ? "inactive" : "active";
  return d;
};
vendors.get("/", h(async (req, res) => {
  const Movie = require("../models/Movie");
  const [list, counts] = await Promise.all([
    Vendor.find({}).sort({ name: 1 }).lean(),
    Movie.aggregate([{ $match: { vendorId: { $nin: [null, ""] } } }, { $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
  ]);
  const byVendor = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ success: true, data: list.map((v) => ({ ...v, movieCount: byVendor.get(String(v._id)) || 0 })) });
}));
vendors.post("/", h(async (req, res) => {
  const d = readVendor(req.body);
  if (!d.name) throw new HttpError(400, "Vendor name is required");
  if (await Vendor.exists({ name: d.name })) throw new HttpError(400, "A vendor with this name already exists");
  const v = await Vendor.create(d);
  res.status(201).json({ success: true, message: "Vendor added", data: v });
}));
vendors.put("/:id", h(async (req, res) => {
  const v = await byId(Vendor, req.params.id, "Vendor");
  v.set(readVendor(req.body));
  await v.save();
  res.json({ success: true, message: "Vendor updated", data: v });
}));
vendors.delete("/:id", h(async (req, res) => {
  const v = await byId(Vendor, req.params.id, "Vendor");
  await v.deleteOne();
  const Movie = require("../models/Movie");
  await Movie.updateMany({ vendorId: String(v._id) }, { $set: { vendorId: "", contentVendor: "Internal" } });
  res.json({ success: true, message: "Vendor deleted" });
}));

/* ───────── App settings (key/value) ───────── */
const settings = express.Router();
const HOME_DEFAULTS = {
  bannerLimit: 5,
  bannerAutoSlideSeconds: 5,
  showContinueWatching: true,
  showTop10: true,
  maintenanceMode: false,
  maintenanceMessage: "",
  minAppVersionAndroid: "",
  minAppVersionIos: "",
  supportEmail: "",
  supportWhatsapp: "",
};
const PUBLIC_SETTINGS = ["home"];
settings.get("/:key", h(async (req, res) => {
  if (!PUBLIC_SETTINGS.includes(req.params.key)) throw new HttpError(404, "Not found");
  const s = await Setting.findOne({ key: req.params.key }).lean();
  const defaults = req.params.key === "home" ? HOME_DEFAULTS : {};
  res.json({ success: true, data: { ...defaults, ...(s?.value || {}) } });
}));
settings.put("/:key", adminAuth, h(async (req, res) => {
  if (!PUBLIC_SETTINGS.includes(req.params.key)) throw new HttpError(400, "Invalid settings key");
  const value = typeof req.body === "object" && req.body ? req.body : {};
  const s = await Setting.findOneAndUpdate({ key: req.params.key }, { value }, { upsert: true, returnDocument: "after" });
  res.json({ success: true, message: "Settings saved", data: s.value });
}));

module.exports = { ads, popups, plans, vendors, settings };
