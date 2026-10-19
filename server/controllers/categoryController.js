// Categories = the tabs in the app (Movies / Web Series / TV Shows …)
const Category = require("../models/Category");
const HomeSection = require("../models/HomeSection");
const Banner = require("../models/Banner");
const WebSeries = require("../models/webseries");
const { HttpError, isId, parseStr, escapeRegex } = require("../lib/http");

const TYPES = ["movie", "webseries", "tvshows"];

const read = (b) => {
  const name = parseStr(b.name);
  let type = parseStr(b.categoryType)?.toLowerCase();
  if (type === "tvshow") type = "tvshows";
  return { name, categoryType: type };
};

exports.getCategories = async (req, res) => {
  const q = {};
  if (req.query.categoryType) q.categoryType = req.query.categoryType;
  const categories = await Category.find(q).sort({ createdAt: 1 });
  res.json({ success: true, count: categories.length, data: categories });
};

exports.createCategory = async (req, res) => {
  const { name, categoryType } = read(req.body);
  if (!name) throw new HttpError(400, "Category name is required");
  if (!TYPES.includes(categoryType)) throw new HttpError(400, "Choose a type: movie, webseries or tvshows");
  if (await Category.exists({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } })) {
    throw new HttpError(400, "A category with this name already exists");
  }
  const category = await Category.create({ name, categoryType });
  res.status(201).json({ success: true, message: "Category created", data: category });
};

exports.updateCategory = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const { name, categoryType } = read(req.body);
  const update = {};
  if (name) {
    const dup = await Category.exists({ _id: { $ne: req.params.id }, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
    if (dup) throw new HttpError(400, "A category with this name already exists");
    update.name = name;
  }
  if (categoryType) {
    if (!TYPES.includes(categoryType)) throw new HttpError(400, "Choose a type: movie, webseries or tvshows");
    update.categoryType = categoryType;
  }
  const category = await Category.findByIdAndUpdate(req.params.id, update, { returnDocument: "after" });
  if (!category) throw new HttpError(404, "Category not found");
  res.json({ success: true, message: "Category updated", data: category });
};

exports.deleteCategory = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new HttpError(404, "Category not found");
  // unlink it everywhere so nothing points to a deleted category
  await Promise.all([
    HomeSection.updateMany({ categoryId: category._id }, { $set: { categoryId: null } }),
    Banner.updateMany({ categoryId: category._id }, { $set: { categoryId: null } }),
    WebSeries.updateMany({ category: category._id }, { $set: { category: null } }),
  ]);
  res.json({ success: true, message: "Category deleted" });
};
