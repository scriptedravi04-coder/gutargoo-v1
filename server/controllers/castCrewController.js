// Cast & crew directory (actors, directors…) used when adding movies / web series.
const CastAndCrew = require("../models/CrewCast");
const Movie = require("../models/Movie");
const bunny = require("../services/bunnyService");
const { CREW_ROLES } = require("../lib/format");
const { uploadImageFile, firstFile } = require("../lib/media");
const { HttpError, isId, parseStr, escapeRegex, paging } = require("../lib/http");

const ROLES = ["Director", "Producer", "Writer", "Music Director", "Cinematographer", "Editor", "Actor", "Other"];

// Movies copy a person's photo (imageUrl + publicId) into their cast / crew lists when picked from
// this library, so the same Bunny file can still be shown by a movie → only delete it when unused.
const PEOPLE_FIELDS = ["castMembers", ...Object.keys(CREW_ROLES)];
const deletePhotoIfUnused = async (publicId, exceptPersonId) => {
  if (!publicId) return;
  try {
    const [movieUses, personUses] = await Promise.all([
      Movie.exists({ $or: PEOPLE_FIELDS.map((f) => ({ [`${f}.publicId`]: publicId })) }),
      CastAndCrew.exists({ _id: { $ne: exceptPersonId }, "profileImage.publicId": publicId }),
    ]);
    if (!movieUses && !personUses) await bunny.deleteImage(publicId);
  } catch (err) {
    console.error("Photo cleanup check failed (kept):", publicId, err.message);
  }
};

const read = (b) => {
  const d = {};
  if (b.personName !== undefined) d.personName = parseStr(b.personName);
  if (b.role !== undefined) d.role = parseStr(b.role);
  if (b.characterName !== undefined) d.characterName = parseStr(b.characterName);
  return d;
};

exports.list = async (req, res) => {
  const { page, limit, skip } = paging(req.query, 25);
  const q = {};
  if (req.query.search) q.personName = { $regex: escapeRegex(req.query.search), $options: "i" };
  if (req.query.role) q.role = req.query.role;
  const [data, total] = await Promise.all([
    CastAndCrew.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CastAndCrew.countDocuments(q),
  ]);
  res.json({ success: true, data, page, limit, total, totalPages: Math.ceil(total / limit) });
};

exports.all = async (req, res) => {
  const data = await CastAndCrew.find({}).sort({ personName: 1 });
  res.json({ success: true, data });
};

exports.getById = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const person = await CastAndCrew.findById(req.params.id);
  if (!person) throw new HttpError(404, "Person not found");
  res.json({ success: true, data: person });
};

exports.create = async (req, res) => {
  const d = read(req.body);
  if (!d.personName) throw new HttpError(400, "Name is required");
  if (!ROLES.includes(d.role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}`);
  const img = await uploadImageFile(firstFile(req, "profileImage"), "profile");
  if (img) d.profileImage = img;
  const person = await CastAndCrew.create(d);
  res.status(201).json({ success: true, message: "Person added", data: person });
};

exports.update = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const person = await CastAndCrew.findById(req.params.id);
  if (!person) throw new HttpError(404, "Person not found");
  const d = read(req.body);
  if (d.role !== undefined && !ROLES.includes(d.role)) throw new HttpError(400, `Role must be one of: ${ROLES.join(", ")}`);
  const img = await uploadImageFile(firstFile(req, "profileImage"), "profile");
  const oldImage = img ? person.profileImage?.publicId : null;
  if (img) d.profileImage = img;
  person.set(d);
  await person.save();
  if (oldImage && oldImage !== img.publicId) deletePhotoIfUnused(oldImage, person._id);
  res.json({ success: true, message: "Person updated", data: person });
};

exports.remove = async (req, res) => {
  if (!isId(req.params.id)) throw new HttpError(400, "Invalid id");
  const person = await CastAndCrew.findByIdAndDelete(req.params.id);
  if (!person) throw new HttpError(404, "Person not found");
  deletePhotoIfUnused(person.profileImage?.publicId, person._id);
  // web series keep a list of person ids → take the deleted person out (no empty "Removed person" chips)
  const WebSeries = require("../models/webseries");
  await WebSeries.updateMany({ castAndCrew: person._id }, { $pull: { castAndCrew: person._id } }).catch(() => {});
  res.json({ success: true, message: "Person deleted" });
};
