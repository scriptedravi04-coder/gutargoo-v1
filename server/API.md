# Gutargoo API (v2)

Base: `https://admin.gutargooplus.com/api`
All replies: `{ success: true, ... }` or on error `{ success: false, message }`.

Auth:
- **Admin** — `POST /auth/login` → `token`. Send `Authorization: Bearer <token>` (7 days).
- **App user** — `POST /otp/verify` → `token` (180 days, `CUSTOMER_TOKEN_DAYS`).
- 🔒 = admin token required · 👤 = app user token required · 🌐 = public.

Multipart = `multipart/form-data`. Array/object fields in multipart are JSON strings (`'["Drama","Action"]'`).
Videos are **not** sent to the server: the admin panel uploads them straight to Bunny (see "Video upload"), then sends only the Bunny `videoId`.

---

## Admin auth
| | Endpoint | Body / notes |
|---|---|---|
| 🌐 | `POST /auth/login` | `{ email, password }` → `{ token, user:{id,name,email,role} }` (10 tries / 15 min) |
| 🔒 | `GET /auth/me` | → `{ user }` |
| 🔒 | `POST /auth/change-password` | `{ currentPassword, newPassword }` (8+ chars) |
| 🔒 | `GET /auth/admins` | list admins |
| 🔒 | `POST /auth/admins` | `{ name, email, password }` |
| 🔒 | `POST /auth/admins/:id/reset-password` | `{ password }` — set a new password for another admin |
| 🔒 | `DELETE /auth/admins/:id` | can't delete yourself / last admin |
| 🔒* | `POST /auth/register` | same as `POST /auth/admins`; works without login **only** when there are zero admins |

## Video upload (Bunny direct)
| | Endpoint | |
|---|---|---|
| 🔒 | `POST /admin/bunny/upload-session` | `{ title }` → `data:{ videoId, libraryId, expires, signature, endpoint }`. Browser then uploads with TUS to `endpoint` using headers `AuthorizationSignature, AuthorizationExpire, VideoId, LibraryId`. |
| 🔒 | `GET /admin/bunny/videos/:videoId` | → `data:{ status, ready, failed, encodeProgress, length, hlsUrl… }` and updates every movie/episode using that video |
| 🌐 | `POST /bunny/webhook` | Bunny calls this when encoding finishes. Set in Bunny Stream library → Webhook URL. |

Video `status`: 4 = ready, 5/6 = failed, 0–3 = processing. A background job also refreshes processing videos every 3 minutes.

## Movies
| | Endpoint | |
|---|---|---|
| 🌐 | `GET /movies` | App: published only, all at once. Admin token: all movies; `?page=&limit=&search=&status=published|draft` adds `pagination{page,limit,total,totalPages}`. Also `?title=`, `?genres=` |
| 🌐 | `GET /movies/:id` | (+1 view for app calls). Admin sees drafts too and gets raw `director…castMembers` arrays. |
| 🌐 | `GET /movies/:id/stream` | play links |
| 🔒 | `GET /movies/options` | `[{_id, movieTitle, releaseYear, posterUrl, publishStatus}]` for dropdowns |
| 🔒 | `POST /movies` | multipart (see fields) |
| 🔒 | `PUT /movies/:id` | multipart; only sent fields change |
| 🔒 | `DELETE /movies/:id` | also removes it from sections/banners/continue-watching and deletes the Bunny video |
| 🔒 | `PATCH /movies/:id/publish` | toggle published |

Movie fields: `movieTitle*, description*, lang*, ageRating*, duration* (minutes), releaseYear*, tagline, fullStoryline, selectedLanguage, imdbRating, budget, awardsAndNominations, videoQuality, audioFormat, contentVendor, vendorId, seoTitle, seoDescription, customVideoUrl, customTrailerUrl, publishDate, expiryDate, releaseDate, skipIntroStart, skipIntroEnd (seconds)`;
booleans `publishStatus, subscriptionRequired, enableAds, allowDownloads, featuredMovie` ("true"/"false");
arrays `genres, tags, productionStudio, countryOfOrigin, audioTracks, subtitles, seoKeywords`;
people (JSON arrays of `{name, character?, imageUrl?}`): `director, producer, writer, musicDirector, cinematographer, editor, castMembers`;
images `logo, horizontalBanner, verticalPoster`; photos `crewImages_<role>_<index>`, `castImage_<index>`;
video: `movieVideoId`, `trailerVideoId` (Bunny ids), `removeTrailer=true`.

Movie reply adds: `videoStreamUrl, playUrl, hlsUrl, mp4Url, trailerStreamUrl, logoUrl, horizontalBannerUrl, verticalPosterUrl, image, crew[{role,name,imageUrl}], cast[{name,character,imageUrl}]`.

## Web series & TV shows
TV shows are web series with `contentType: "tvshow"`.
| | Endpoint | |
|---|---|---|
| 🌐 | `GET /webseries` | app: published only. `?contentType=webseries|tvshow`, `?search=` |
| 🌐 | `GET /webseries/:id` | |
| 🔒 | `GET /webseries/options` | dropdown list |
| 🔒 | `POST /webseries` · `PUT /webseries/:id` | multipart: `title*, description, genres[], lang, ageRating, imdbRating, releaseDate, contentType, isPublished, subscriptionRequired, category, castAndCrew[]`, images `thumbnail, verticalPoster, banner`, `trailerVideoId`, `customTrailerUrl`, `removeTrailer` |
| 🔒 | `DELETE /webseries/:id` · `PATCH /webseries/:id/publish` | |
| 🔒 | `POST /webseries/:id/seasons` | `{ seasonNumber?, title?, releaseDate? }` |
| 🔒 | `PUT · DELETE /webseries/:id/seasons/:seasonId` | |
| 🔒 | `POST /webseries/:id/seasons/:seasonId/episodes` | multipart: `title*, episodeNumber?, description, releaseDate, isPublished, videoId (Bunny), customVideoUrl, skipIntroStart, skipIntroEnd`, image `thumbnail` |
| 🔒 | `PUT · DELETE /webseries/:id/seasons/:seasonId/episodes/:episodeId` | |

All series admin endpoints reply with the full series. Reply shape: images are URL strings (`thumbnail, verticalPoster, horizontalBanner, banner`), `genres`, `type`, `total_seasons`, `total_episodes`, `seasons[].episodes[].videoFile{url,status,videoId,duration}`, `trailer{url}`.

## Home
| | Endpoint | |
|---|---|---|
| 🌐 | `GET /admin/sections/allList` | app home rows (active only; automatic sources resolved) |
| 🔒 | `GET /admin/sections` | all, with `categoryId`, `sectionData.movies/webseries` populated |
| 🔒 | `POST /admin/sections` · `PUT /admin/sections/:id` | `{ title*, contentSource, displayStyle, categoryId, isActive, itemLimit, trendingPeriodDays, sectionData:{ movies:[ids], webseries:[ids] } }` |
| 🔒 | `PUT /admin/sections/reorder` | `{ ids: [ALL section ids in order] }` |
| 🔒 | `DELETE /admin/sections/:id` · `PATCH /admin/sections/:id/toggle` | |
| 🌐 | `GET /banners` | app: published only. Admin: all. `?limit=` |
| 🔒 | `POST /banners` · `PUT /banners/:id` | multipart: `title*, description, bannerType (single_movie|web_series), movieId | webseriesId, categoryId, displayOrder, publishStatus`, images `bannerImage*` (create), `logoImage` |
| 🔒 | `DELETE /banners/:id` · `PATCH /banners/:id/toggle-publish` · `PUT /banners/reorder {ids}` | |
| 🌐 | `GET /popups` | the one active popup `{_id,title,image,isActive}` or `null` |
| 🔒 | `GET /popups/admin/all` · `POST /popups` · `PUT /popups/:id` · `DELETE /popups/:id` | multipart `title, link, isActive, image` — turning one on turns the others off |
| 🌐 | `GET /settings/home` · 🔒 `PUT /settings/home` | free-form JSON (bannerLimit, maintenanceMode…) — **app does not read this yet** |

contentSource: `admin_selected | recently_added | most_viewed | watch_time_based | auto`.
displayStyle: `vertical_banner | horizontal_banner | big_vertical | big_horizontal | index_vertical (Top 10) | index_horizontal`.

## Catalog
| | Endpoint | |
|---|---|---|
| 🌐 | `GET /category` | |
| 🔒 | `POST /category` · `PUT /category/:id` · `DELETE /category/:id` | `{ name, categoryType: movie|webseries|tvshows }` |
| 🔒 | `GET /castAndCrew?page=&limit=&search=&role=` | `{data,total,totalPages}` |
| 🔒 | `GET /castAndCrew/getAll` | everyone (for pickers) |
| 🔒 | `POST /castAndCrew` · `PUT /castAndCrew/:id` | multipart `personName*, role*, characterName, profileImage` |
| 🔒 | `DELETE /castAndCrew/:id` | |

Roles: Director, Producer, Writer, Music Director, Cinematographer, Editor, Actor, Other.

## Users, codes, money
| | Endpoint | |
|---|---|---|
| 🔒 | `GET /admin/customers?page=&limit=&search=&filter=premium|blocked` | `{data,total,totalPages}`; each has `isPremium, subscriptionActive` |
| 🔒 | `PATCH /admin/customers/:id` | `{ name, isBlocked, isPremium, coins, addSubscriptionDays, subscriptionExpiry:null }` |
| 🔒 | `GET /admin/stats` | dashboard numbers |
| 🔒 | `GET /redeem/admin/all` · `POST /redeem/admin/create` · `PUT /redeem/admin/:id` · `DELETE /redeem/admin/:id` | `{ code*, type* (coins|subscription|premium), value, expiryDate*, maxUses, description, showInApp, isActive }` |
| 👤 | `GET /redeem/list` · `POST /redeem {code}` | app |
| 🌐 | `GET /ads/all` | app: active ads |
| 🔒 | `GET /ads` · `POST /ads` · `PUT /ads/:id` · `DELETE /ads/:id` | `{ title, vastUrl*, isActive, positionType (start|mid|end|custom|multiple), showAt, duration, multiplePositions[] }` |
| 🌐 | `GET /plans` · 🔒 `GET /plans/admin/all` · `POST/PUT/DELETE /plans` | `{ name*, price*, originalPrice, durationDays*, features[], googlePlayProductId, appleProductId, isPopular, isActive, displayOrder }` — **app has no purchase screen yet** |
| 🔒 | `GET /vendors` (with `movieCount`) · `POST · PUT · DELETE /vendors` | `{ name*, contactPerson, email, phone, revenueShare, status, notes }` |

## App-only
| | Endpoint | |
|---|---|---|
| 🌐 | `POST /otp/send {mobile}` · `POST /otp/verify {mobile, otp}` | rate-limited; optional reviewer test number via `OTP_TEST_MOBILE` / `OTP_TEST_CODE` |
| 👤 | `GET /continue-watching` · `POST /continue-watching/save` · `DELETE /continue-watching/:movieId` | |
| 👤 | `GET /download/:movieOrEpisodeId` | `{ url }` direct MP4 (needs Bunny "MP4 fallback" ON) |
| 👤 | `GET/PUT/DELETE /customer/profile` | |
| 🌐/👤 | `GET /movie-likes/:movieId`, `POST /movie-likes/:movieId` | |
| 🌐 | `GET /search?query=` | |
