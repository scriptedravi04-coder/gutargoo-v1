// Form state, constants and helpers for the movie add/edit page.
import { format } from "date-fns";
import { toFormData, VideoRef } from "@/lib/api";

// ───────── Constants ─────────
export const GENRES = ["Action", "Drama", "Comedy", "Thriller", "Horror", "Romance", "Crime", "Family", "Sci-Fi", "Adventure", "Animation", "Documentary", "Mystery", "Fantasy"];
export const LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Bengali", "Marathi", "Punjabi", "Gujarati", "Kannada", "Malayalam", "Bhojpuri", "Other"];
export const AGE_RATINGS = ["U", "U/A 7+", "U/A 13+", "U/A 16+", "A"];
export const VIDEO_QUALITIES = ["Auto (Adaptive)", "4K", "1080p", "720p", "480p"];
export const AUDIO_FORMATS = ["Stereo", "5.1 Surround", "Dolby Atmos"];

export type CrewKey = "director" | "producer" | "writer" | "musicDirector" | "cinematographer" | "editor";
export type PeopleKey = CrewKey | "castMembers";

export const CREW_ROLES: { key: CrewKey; label: string }[] = [
  { key: "director", label: "Director" },
  { key: "producer", label: "Producer" },
  { key: "writer", label: "Writer" },
  { key: "musicDirector", label: "Music Director" },
  { key: "cinematographer", label: "Cinematographer" },
  { key: "editor", label: "Editor" },
];
export const PEOPLE_KEYS: PeopleKey[] = [...CREW_ROLES.map((r) => r.key), "castMembers"];

// ───────── Types ─────────
export interface Person {
  key: string; // React list key only (never sent)
  name: string;
  character: string;
  imageUrl: string;
  publicId: string;
  file: File | null;
}

export type People = Record<PeopleKey, Person[]>;

export interface MovieFields {
  movieTitle: string;
  tagline: string;
  description: string;
  fullStoryline: string;
  genres: string[];
  tags: string[];
  lang: string;
  ageRating: string;
  duration: string;
  releaseYear: string;
  releaseDate: string; // yyyy-MM-dd
  imdbRating: string;
  customVideoUrl: string;
  customTrailerUrl: string;
  skipIntroStart: string;
  skipIntroEnd: string;
  productionStudio: string[];
  countryOfOrigin: string[];
  budget: string;
  awardsAndNominations: string;
  videoQuality: string;
  audioFormat: string;
  audioTracks: string[];
  subtitles: string[];
  vendorId: string; // "" = Internal
  publishStatus: boolean;
  subscriptionRequired: boolean;
  enableAds: boolean;
  allowDownloads: boolean;
  featuredMovie: boolean;
  publishDate: string; // yyyy-MM-ddTHH:mm (local)
  expiryDate: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
}

export interface ImageFiles {
  verticalPoster: File | null;
  horizontalBanner: File | null;
  logo: File | null;
}

/** The movie as the admin API returns it (only the fields this page reads). */
export interface MovieRecord {
  _id: string;
  movieTitle?: string;
  tagline?: string;
  description?: string;
  fullStoryline?: string;
  genres?: string[];
  tags?: string[];
  lang?: string;
  ageRating?: string;
  duration?: number;
  releaseYear?: number;
  releaseDate?: string | null;
  imdbRating?: number;
  movieFile?: VideoRef;
  trailer?: VideoRef;
  customVideoUrl?: string;
  customTrailerUrl?: string;
  skipIntro?: { start?: number; end?: number };
  verticalPosterUrl?: string;
  horizontalBannerUrl?: string;
  logoUrl?: string;
  productionStudio?: string[];
  countryOfOrigin?: string[];
  budget?: string;
  awardsAndNominations?: string;
  videoQuality?: string;
  audioFormat?: string;
  audioTracks?: string[];
  subtitles?: string[];
  vendorId?: string;
  contentVendor?: string;
  publishStatus?: boolean;
  subscriptionRequired?: boolean;
  enableAds?: boolean;
  allowDownloads?: boolean;
  featuredMovie?: boolean;
  publishDate?: string | null;
  expiryDate?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  viewCount?: number;
  director?: RawPerson[];
  producer?: RawPerson[];
  writer?: RawPerson[];
  musicDirector?: RawPerson[];
  cinematographer?: RawPerson[];
  editor?: RawPerson[];
  castMembers?: RawPerson[];
}

interface RawPerson {
  name?: string;
  character?: string;
  imageUrl?: string;
  publicId?: string;
}

export interface Vendor {
  _id: string;
  name: string;
  status?: string;
}

// ───────── Helpers ─────────
let keySeq = 0;
export const newPerson = (p: Partial<Person> = {}): Person => ({
  key: `p${++keySeq}`,
  name: p.name || "",
  character: p.character || "",
  imageUrl: p.imageUrl || "",
  publicId: p.publicId || "",
  file: null,
});

export const emptyPeople = (): People => ({
  director: [],
  producer: [],
  writer: [],
  musicDirector: [],
  cinematographer: [],
  editor: [],
  castMembers: [],
});

export const emptyFields = (): MovieFields => ({
  movieTitle: "",
  tagline: "",
  description: "",
  fullStoryline: "",
  genres: [],
  tags: [],
  lang: "Hindi",
  ageRating: "U/A 13+",
  duration: "",
  releaseYear: String(new Date().getFullYear()),
  releaseDate: "",
  imdbRating: "",
  customVideoUrl: "",
  customTrailerUrl: "",
  skipIntroStart: "0",
  skipIntroEnd: "0",
  productionStudio: [],
  countryOfOrigin: [],
  budget: "",
  awardsAndNominations: "",
  videoQuality: "Auto (Adaptive)",
  audioFormat: "Stereo",
  audioTracks: [],
  subtitles: [],
  vendorId: "",
  publishStatus: false,
  subscriptionRequired: false,
  enableAds: true,
  allowDownloads: false,
  featuredMovie: false,
  publishDate: "",
  expiryDate: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: [],
});

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd'T'HH:mm");
};
const numStr = (n?: number | null) => (n === undefined || n === null ? "" : String(n));

// A "custom link" that is just the Bunny link of the uploaded video is not a real custom link:
// show it empty (and so send "" on save).
const realCustomLink = (url?: string, video?: VideoRef) => {
  if (!url) return "";
  if (video?.videoId && url.includes(video.videoId)) return "";
  return url;
};

export const fieldsFromMovie = (m: MovieRecord): MovieFields => ({
  movieTitle: m.movieTitle || "",
  tagline: m.tagline || "",
  description: m.description || "",
  fullStoryline: m.fullStoryline || "",
  genres: m.genres || [],
  tags: m.tags || [],
  lang: m.lang || "",
  ageRating: m.ageRating || "",
  duration: numStr(m.duration),
  releaseYear: numStr(m.releaseYear),
  releaseDate: m.releaseDate ? String(m.releaseDate).slice(0, 10) : "",
  imdbRating: m.imdbRating ? String(m.imdbRating) : "",
  customVideoUrl: realCustomLink(m.customVideoUrl, m.movieFile),
  customTrailerUrl: realCustomLink(m.customTrailerUrl, m.trailer),
  skipIntroStart: String(m.skipIntro?.start || 0),
  skipIntroEnd: String(m.skipIntro?.end || 0),
  productionStudio: m.productionStudio || [],
  countryOfOrigin: m.countryOfOrigin || [],
  budget: m.budget || "",
  awardsAndNominations: m.awardsAndNominations || "",
  videoQuality: m.videoQuality || "Auto (Adaptive)",
  audioFormat: m.audioFormat || "Stereo",
  audioTracks: m.audioTracks || [],
  subtitles: m.subtitles || [],
  vendorId: m.vendorId || "",
  publishStatus: !!m.publishStatus,
  subscriptionRequired: !!m.subscriptionRequired,
  enableAds: m.enableAds !== false,
  allowDownloads: !!m.allowDownloads,
  featuredMovie: !!m.featuredMovie,
  publishDate: toLocalInput(m.publishDate),
  expiryDate: toLocalInput(m.expiryDate),
  seoTitle: m.seoTitle || "",
  seoDescription: m.seoDescription || "",
  seoKeywords: m.seoKeywords || [],
});

export const peopleFromMovie = (m: MovieRecord): People => {
  const out = emptyPeople();
  for (const key of PEOPLE_KEYS) out[key] = (m[key] || []).map((p) => newPerson(p));
  return out;
};

// ───────── Validation ─────────
export type Errors = Record<string, string>;

/** Field ids in the order they appear on the page (used to scroll to the first error). */
export const FIELD_ORDER = [
  "movieTitle",
  "description",
  "genres",
  "lang",
  "ageRating",
  "duration",
  "releaseYear",
  "imdbRating",
  "customVideoUrl",
  "customTrailerUrl",
  "skipIntro",
  ...PEOPLE_KEYS.map((k) => `people_${k}`),
  "expiryDate",
];

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export const validate = (f: MovieFields, people: People): Errors => {
  const e: Errors = {};
  const year = new Date().getFullYear();
  // Only the title is required — the server fills sensible defaults for the rest
  if (!f.movieTitle.trim()) e.movieTitle = "Please enter the movie title.";

  const dur = Number(f.duration);
  if (f.duration.trim() && (!Number.isFinite(dur) || dur <= 0)) e.duration = "Length in minutes, e.g. 125 (or leave empty — it's filled from the video).";

  const ry = Number(f.releaseYear);
  if (f.releaseYear.trim() && (!Number.isInteger(ry) || ry < 1900 || ry > year + 5)) e.releaseYear = `Enter a year between 1900 and ${year + 5}.`;

  if (f.imdbRating.trim()) {
    const r = Number(f.imdbRating);
    if (!Number.isFinite(r) || r < 0 || r > 10) e.imdbRating = "Rating must be between 0 and 10.";
  }
  if (f.customVideoUrl.trim() && !isUrl(f.customVideoUrl)) e.customVideoUrl = "Link must start with http:// or https://";
  if (f.customTrailerUrl.trim() && !isUrl(f.customTrailerUrl)) e.customTrailerUrl = "Link must start with http:// or https://";

  const s = Number(f.skipIntroStart || 0);
  const en = Number(f.skipIntroEnd || 0);
  if (!Number.isFinite(s) || !Number.isFinite(en) || s < 0 || en < 0) e.skipIntro = "Use whole seconds (0 or more).";
  else if ((s > 0 || en > 0) && en <= s) e.skipIntro = "The intro end must be after the intro start.";

  for (const key of PEOPLE_KEYS) {
    if (people[key].some((p) => !p.name.trim() && (p.file || p.imageUrl || p.character.trim()))) {
      e[`people_${key}`] = "Every person needs a name (or remove the empty row).";
    }
  }

  if (f.publishDate && f.expiryDate && new Date(f.expiryDate) <= new Date(f.publishDate)) {
    e.expiryDate = "Expiry must be after the publish date.";
  }
  return e;
};

// ───────── Submit ─────────
interface BuildArgs {
  fields: MovieFields;
  people: People;
  images: ImageFiles;
  vendors: Vendor[] | null; // null = vendor list not available → leave vendor fields unchanged
  movieVideoId: string | null;
  trailerVideoId: string | null;
  removeTrailer: boolean;
  /** remove the saved title logo (optional image) */
  removeLogo?: boolean;
  original?: MovieRecord; // edit mode
}

const toIso = (local: string) => {
  const d = new Date(local);
  return isNaN(d.getTime()) ? "" : d.toISOString();
};

export const buildFormData = ({ fields: f, people, images, vendors, movieVideoId, trailerVideoId, removeTrailer, removeLogo, original }: BuildArgs): FormData => {
  const vendor = vendors?.find((v) => v._id === f.vendorId);

  // Final people arrays: blank rows dropped, so the photo index = position in what we send.
  const finalPeople = {} as Record<PeopleKey, Person[]>;
  for (const key of PEOPLE_KEYS) finalPeople[key] = people[key].filter((p) => p.name.trim());

  const scalars: Record<string, unknown> = {
    movieTitle: f.movieTitle.trim(),
    tagline: f.tagline.trim(),
    description: f.description.trim(),
    fullStoryline: f.fullStoryline.trim(),
    genres: f.genres,
    tags: f.tags,
    lang: f.lang.trim(),
    ageRating: f.ageRating,
    duration: Number(f.duration),
    releaseYear: Number(f.releaseYear),
    releaseDate: f.releaseDate || "",
    imdbRating: f.imdbRating.trim() ? Number(f.imdbRating) : 0,
    customVideoUrl: f.customVideoUrl.trim(),
    customTrailerUrl: f.customTrailerUrl.trim(),
    skipIntroStart: Number(f.skipIntroStart || 0),
    skipIntroEnd: Number(f.skipIntroEnd || 0),
    productionStudio: f.productionStudio,
    countryOfOrigin: f.countryOfOrigin,
    budget: f.budget.trim(),
    awardsAndNominations: f.awardsAndNominations.trim(),
    videoQuality: f.videoQuality,
    audioFormat: f.audioFormat,
    audioTracks: f.audioTracks,
    subtitles: f.subtitles,
    publishStatus: f.publishStatus ? "true" : "false",
    subscriptionRequired: f.subscriptionRequired ? "true" : "false",
    enableAds: f.enableAds ? "true" : "false",
    allowDownloads: f.allowDownloads ? "true" : "false",
    featuredMovie: f.featuredMovie ? "true" : "false",
    seoTitle: f.seoTitle.trim(),
    seoDescription: f.seoDescription.trim(),
    seoKeywords: f.seoKeywords,
  };

  if (vendors) {
    scalars.vendorId = vendor ? vendor._id : "";
    scalars.contentVendor = vendor ? vendor.name : "Internal";
  }

  // Dates: send when set; send "" only to clear a date the movie already had.
  if (f.publishDate) scalars.publishDate = toIso(f.publishDate);
  else if (original?.publishDate) scalars.publishDate = "";
  if (f.expiryDate) scalars.expiryDate = toIso(f.expiryDate);
  else if (original?.expiryDate) scalars.expiryDate = "";

  // People are always sent (even empty) so removing everyone works.
  for (const key of PEOPLE_KEYS) {
    scalars[key] = finalPeople[key].map((p) => ({
      name: p.name.trim(),
      ...(key === "castMembers" ? { character: p.character.trim() } : {}),
      imageUrl: p.imageUrl,
      publicId: p.publicId,
    }));
  }

  if (movieVideoId) scalars.movieVideoId = movieVideoId;
  if (trailerVideoId) scalars.trailerVideoId = trailerVideoId;
  else if (removeTrailer) scalars.removeTrailer = "true";
  if (removeLogo && !images.logo && original?.logoUrl) scalars.removeLogo = "true";

  const fd = toFormData(scalars);

  if (images.verticalPoster) fd.append("verticalPoster", images.verticalPoster);
  if (images.horizontalBanner) fd.append("horizontalBanner", images.horizontalBanner);
  if (images.logo) fd.append("logo", images.logo);

  for (const { key } of CREW_ROLES) {
    finalPeople[key].forEach((p, i) => {
      if (p.file) fd.append(`crewImages_${key}_${i}`, p.file);
    });
  }
  finalPeople.castMembers.forEach((p, i) => {
    if (p.file) fd.append(`castImage_${i}`, p.file);
  });

  return fd;
};
