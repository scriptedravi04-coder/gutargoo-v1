// READ-ONLY health check of the live database. Changes nothing.
//   node scripts/check-db.js
// Run it before and after deploying the new backend and send the output to the team.
require("../lib/loadEnv").loadEnv();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const line = (t) => console.log(t);
  const now = new Date();

  line("\n=== Collections ===");
  for (const c of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
    line(`${c.name.padEnd(24)} ${await col(c.name).estimatedDocumentCount()}`);
  }

  line("\n=== Admin accounts (users collection) — remove any you don't recognise ===");
  for (const u of await col("users").find({}, { projection: { email: 1, role: 1, createdAt: 1 } }).toArray()) {
    line(`${String(u.email).padEnd(36)} role=${u.role ?? "(none)"}  created=${u.createdAt?.toISOString?.().slice(0, 10) || "?"}`);
  }

  line("\n=== Home sections (order / active / source / hand-picked count) ===");
  for (const s of await col("homesections").find({}).sort({ displayOrder: 1 }).toArray()) {
    line(`${String(s.displayOrder).padStart(3)}  ${s.isActive === false ? "OFF" : "ON "}  ${String(s.contentSource).padEnd(16)} movies=${(s.sectionData?.movies || []).length} series=${(s.sectionData?.webseries || []).length}  "${s.title}"`);
  }

  line("\n=== Movies ===");
  const movies = await col("movies").find({}, { projection: { movieTitle: 1, publishStatus: 1, publishDate: 1, expiryDate: 1, movieFile: 1, customVideoUrl: 1 } }).toArray();
  const byVideo = {};
  for (const m of movies) if (m.movieFile?.videoId) (byVideo[m.movieFile.videoId] ||= []).push(m.movieTitle);
  line(`total=${movies.length}  published=${movies.filter((m) => m.publishStatus !== false).length}`);
  line(`no video at all: ${movies.filter((m) => !m.movieFile?.videoId && !m.customVideoUrl).map((m) => m.movieTitle).join(", ") || "none"}`);
  line(`video not ready (status≠4): ${movies.filter((m) => m.movieFile?.videoId && m.movieFile.status !== 4).map((m) => `${m.movieTitle} (${m.movieFile.status})`).join(", ") || "none"}`);
  line(`same video on 2+ movies: ${Object.values(byVideo).filter((t) => t.length > 1).map((t) => t.join(" + ")).join(" | ") || "none"}`);
  line(`hidden by future publish date: ${movies.filter((m) => m.publishDate && m.publishDate > now).map((m) => m.movieTitle).join(", ") || "none"}`);
  line(`hidden by past expiry date: ${movies.filter((m) => m.expiryDate && m.expiryDate <= now).map((m) => m.movieTitle).join(", ") || "none"}`);

  line("\n=== Web series ===");
  for (const w of await col("webseries").find({}, { projection: { title: 1, isPublished: 1, contentType: 1, seasons: 1 } }).toArray()) {
    const eps = (w.seasons || []).reduce((n, s) => n + (s.episodes || []).length, 0);
    line(`${w.isPublished === false ? "DRAFT" : "LIVE "}  ${(w.contentType || "webseries").padEnd(9)}  seasons=${(w.seasons || []).length} episodes=${eps}  "${w.title}"`);
  }

  line("\n=== Continue watching (old data check) ===");
  const cw = col("continuewatchings");
  const sample = await cw.findOne({});
  line(sample ? `fields in one record: ${Object.keys(sample).join(", ")}` : "empty / not created yet");
  const dups = await cw.aggregate([{ $group: { _id: { u: "$user", m: "$movie" }, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "dups" }]).toArray();
  line(`duplicate user+movie rows (block the new unique index): ${dups[0]?.dups || 0}`);

  line("\n=== Indexes that failed to build would show as warnings in the server log on startup ===\n");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Check failed:", e.message);
  process.exit(1);
});
