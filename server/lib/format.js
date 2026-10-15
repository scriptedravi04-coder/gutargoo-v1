// Turns database records into the exact JSON shape the mobile app and admin panel read.
// ⚠️ The mobile app depends on these key names. Do not rename keys — only add new ones.

const CREW_ROLES = {
  director: "Director",
  producer: "Producer",
  writer: "Writer",
  musicDirector: "Music Director",
  cinematographer: "Cinematographer",
  editor: "Editor",
};

const plain = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : { ...(doc || {}) });
const urlOf = (v) => (typeof v === "string" ? v : v?.url || "");

const formatCrew = (m) => {
  const crew = [];
  for (const [key, label] of Object.entries(CREW_ROLES)) {
    for (const p of m[key] || []) {
      crew.push({ _id: p._id, role: label, name: p.name, imageUrl: p.imageUrl || "", publicId: p.publicId || "" });
    }
  }
  return crew;
};

// Best playable link for a video sub-document
const videoLink = (video, custom) => custom || video?.hlsUrl || video?.url || null;

/**
 * Movie → app JSON.
 * opts.admin = true keeps the raw crew fields (director, producer… castMembers) so the admin edit form can load them.
 */
const formatMovie = (doc, opts = {}) => {
  if (!doc) return null;
  const m = plain(doc);
  const crew = formatCrew(m);
  const cast = (m.castMembers || []).map((c) => ({
    _id: c._id,
    name: c.name,
    character: c.character || "",
    imageUrl: c.imageUrl || "",
    publicId: c.publicId || "",
  }));

  const videoStreamUrl = videoLink(m.movieFile, m.customVideoUrl);
  const trailerStreamUrl = videoLink(m.trailer, m.customTrailerUrl);

  const out = {
    ...m,
    videoStreamUrl,
    hlsUrl: m.movieFile?.hlsUrl,
    mp4Url: m.movieFile?.mp4Url,
    directPlayUrl: m.movieFile?.directPlayUrl,
    thumbnailUrl: m.movieFile?.thumbnailUrl,
    playUrl: videoStreamUrl,
    videoMovies: videoStreamUrl,
    trailerStreamUrl,
    trailerHlsUrl: m.trailer?.hlsUrl,
    trailerMp4Url: m.trailer?.mp4Url,
    trailerDirectPlayUrl: m.trailer?.directPlayUrl,
    trailerThumbnailUrl: m.trailer?.thumbnailUrl,
    logoUrl: m.logo?.url,
    horizontalBannerUrl: m.horizontalBanner?.url,
    verticalPosterUrl: m.verticalPoster?.url,
    image: m.verticalPoster?.url || m.horizontalBanner?.url || "",
    crew,
    cast,
  };

  if (!opts.admin) {
    for (const key of [...Object.keys(CREW_ROLES), "castMembers", "createdBy"]) delete out[key];
  }
  return out;
};

const formatEpisode = (ep) => {
  const e = plain(ep);
  const link = videoLink(e.videoFile, e.customVideoUrl);
  const videoFile = {
    url: link || "",
    hlsUrl: e.videoFile?.hlsUrl || "",
    mp4Url: e.videoFile?.mp4Url || "",
    thumbnailUrl: e.videoFile?.thumbnailUrl || urlOf(e.thumbnail),
    duration: e.videoFile?.duration || 0,
    status: e.videoFile?.status ?? 0,
    videoId: e.videoFile?.videoId || "",
  };
  return {
    ...e,
    thumbnail: urlOf(e.thumbnail) || e.videoFile?.thumbnailUrl || "",
    videoFile,
    videoStreamUrl: link,
    playUrl: link,
    skipIntro: { start: e.skipIntro?.start || 0, end: e.skipIntro?.end || 0 },
  };
};

/** Web series / TV show → app JSON (images as plain URL strings, which is what the app reads). */
const formatWebSeries = (doc, opts = {}) => {
  if (!doc) return null;
  const w = plain(doc);
  const verticalPoster = urlOf(w.verticalPoster) || urlOf(w.thumbnail);
  const horizontalBanner = urlOf(w.banner);
  const thumbnail = urlOf(w.thumbnail) || verticalPoster;
  const trailerStreamUrl = videoLink(w.trailer, w.customTrailerUrl);

  let seasons = (w.seasons || []).map((s) => ({
    ...s,
    episodes: (s.episodes || []).map(formatEpisode),
  }));
  if (!opts.admin) {
    seasons = seasons.map((s) => ({ ...s, episodes: s.episodes.filter((e) => e.isPublished !== false) }));
  }
  const totalEpisodes = seasons.reduce((n, s) => n + s.episodes.length, 0);

  return {
    ...w,
    type: w.contentType === "tvshow" ? "tvshow" : "webseries",
    contentType: w.contentType || "webseries",
    genres: w.genre || [],
    thumbnail,
    verticalPoster,
    horizontalBanner,
    banner: horizontalBanner,
    verticalPosterUrl: verticalPoster,
    horizontalBannerUrl: horizontalBanner,
    image: verticalPoster,
    trailer: w.trailer
      ? { ...w.trailer, url: trailerStreamUrl || "", thumbnailUrl: w.trailer.thumbnailUrl || "" }
      : trailerStreamUrl
      ? { url: trailerStreamUrl, thumbnailUrl: "" }
      : null,
    trailerStreamUrl,
    seasons,
    totalSeasons: seasons.length,
    totalEpisodes,
    total_seasons: seasons.length,
    total_episodes: totalEpisodes,
  };
};

/** One card inside a home section (sectionData item). */
const sectionItemFromMovie = (m) => {
  const f = formatMovie(m);
  return {
    _id: f._id,
    type: "movie",
    title: f.movieTitle || "",
    verticalPosterUrl: f.verticalPoster?.url || "",
    horizontalBannerUrl: f.horizontalBanner?.url || "",
    verticalPoster: f.verticalPoster,
    horizontalBanner: f.horizontalBanner,
    image: f.image,
    videoStreamUrl: f.videoStreamUrl,
    playUrl: f.playUrl,
    hlsUrl: f.hlsUrl,
    customVideoUrl: f.customVideoUrl,
    imdbRating: f.imdbRating || 0,
    description: f.description || "",
    genre: f.genres || f.tags || [],
  };
};

const sectionItemFromSeries = (w) => {
  const f = formatWebSeries(w);
  return {
    _id: f._id,
    type: f.type, // "webseries" or "tvshow"
    title: f.title || "",
    verticalPosterUrl: f.verticalPoster,
    horizontalBannerUrl: f.horizontalBanner,
    verticalPoster: { url: f.verticalPoster },
    horizontalBanner: { url: f.horizontalBanner },
    image: f.image,
    imdbRating: f.imdbRating || 0,
    description: f.description || "",
    genre: f.genres || [],
  };
};

module.exports = { formatMovie, formatWebSeries, formatEpisode, sectionItemFromMovie, sectionItemFromSeries, CREW_ROLES };
