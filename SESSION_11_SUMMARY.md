# Session 11 — v3 mobile UI + one-secret settings (GG_ENV)

## 1. GG_ENV (ek secret mein saari settings)
- `server/lib/loadEnv.js`: `.env` (local) → normal env vars → `GG_ENV` (wins). Lines `KEY=value`, one-line squashed text, or JSON.
  Skips `PORT`/`K_SERVICE`/`NODE_ENV`. Used by `server.js` and both scripts.
- `GG_ENV.example.txt` = template list. Store links come from `PLAY_STORE_URL` / `APP_STORE_URL` at runtime
  (server injects `window.__GG` into index.html; re-read when a new build lands).

## 2. Website v3 (phones) — from "Gutargoo App v3" + "Developer Notes" (Claude Design)
Phones get the new UI (`src/viewer/v3/*`); laptop / desktop / TV keep the big-screen layout (now red accent only).
- **Potli** (`/potli`, cold start opens here once per visit): vertical snap feed of trailers (titles without a trailer show the poster),
  only the visible clip plays, next 2 preload muted, tap = pause (glass play icon), ended → next, 2px progress above the nav,
  For you / Trailers / Dramas ("coming soon" toast), Like (account for movies) / Save / Share rail,
  "Watch now" glass card after N s of playing (N = admin Home Settings → Potli, default 15), gold Unlock for premium.
- **Home**: logo · search · avatar; blurred header layer after 24px; chips All · Movies · Web Series · TV Shows with empty states;
  hero carousel (admin banners, phone picture, auto-slide from admin, progress dots, swipe), CTA says exactly what happens
  (Play / Play S1 E1 / Resume S1 E3 / Resume · 1h 29m left / Unlock with Premium); Continue watching (S/E badge, red line, "24m left · 3 more episodes");
  admin Section Builder rows with See all; Top 10 (gradient numbers); #basekaurepisode footer with greyscale poster strip.
- **Detail**: screen leaves (slide/scale/blur 380ms) → poster drops in → text de-blurs in a stagger; notch play button with red ring plays the trailer in place;
  chips, rating, Like / My List (pop), CTA + resume line, gold premium card, Synopsis More/Less, Episodes (season pill, progress, Watched, Coming soon + Remind me),
  Cast cards (photo or initials), "Because you watched" (3 × shared genres + same type + rating/10).
- **Player** (also desktop): new overlay (collapse · episode line · Quality/Speed sheet · fullscreen, −10 / play / +10, seek with buffer + time left),
  double-tap ±10 s with half-moon ripple that adds up (20, 30…), vertical drag left = brightness / right = volume with HUD,
  single tap waits 300 ms, Skip intro (admin markers), Up next card in the last 15 s with countdown / Play now / ✕, "Tap for sound" chip,
  one-time gesture tip, Up next list, Because you watched.
- **Search** (live, 250 ms), **My List** (3-col grid, remove with Undo, **synced to the account**: new `GET/PUT /api/customer/watchlist`,
  guest list merges on login, cleared from the device on sign-out), **Profile** (account/guest card, Edit name sheet, Premium, Redeem sheet with
  available codes, Get the app, Install web app, Help, Privacy, About sheet, one Sign out with confirm, clapperboard + 5-tap credits egg),
  **Login** (cover-flow posters, carousel shrinks on focus, +91 n/10, OTP boxes auto-submit, shake on wrong code, 30 s resend, name step for new accounts),
  **Plans** (admin plans, 3 cards, sticky gold CTA — web payment not connected: CTA sends signed-in users to the app).
- Toast with Undo (3.5 s, above the tab bar). Fonts DM Sans + Outfit self-hosted (`public/fonts`). `prefers-reduced-motion` → fades.
- Premium on web: a signed-in subscriber (premium on the number) can play premium titles on the web (all free right now anyway).

## 3. Admin
- Home Settings: new "Potli: show Watch now after (seconds)"; note updated — website uses these settings right away.

## Tested (sandbox, real Chromium + real server + MongoDB-compatible DB + fake Bunny)
API 50/55 (the 5: test-script quirks + FerretDB-only `$text`/`$ifNull`). Mobile: Potli play/pause/swipe/tabs, Home chips/empty states/hero/Undo,
Detail trailer/like/similar/back stack, Player gestures/speed/Up next/auto next episode, OTP login wrong + right, My List sync across two devices,
desktop home + player. Not testable here: live Bunny/DB and real iPhone.

## Fixed after an independent code review
Potli sound only unmutes on a real tap (iPhone-safe, "Tap for sound" chip), poster clips keep 30 s with Reduce Motion, Potli remembers feed + clip on Back,
only nearby clips load; My List removals stick across devices (account wins after the one-time guest merge), list leaves the device on sign-out / expired login;
Login returns to the page you came from (no duplicate page); OTP can't be verified twice; Up next card no longer blocks the controls;
iPhone volume drag = mute/unmute; hero auto-slide survives a hidden tab; sheets render above the tab bar; ambient red glow fixed;
progress saved every 10 s; premium status refreshed site-wide and reset on sign-out.

## Open (from the designer's notes)
Web payments (provider), real "votes", reels/dramas content for Potli, analytics events.

## Free Premium for the first 1000 (Founding Members)
- Website shows "Free Premium for the first 1,000" instead of paid plans: gold card on Home, Premium page with **live spots left**,
  one tap claim (guests sign in with OTP first, then come back), success screen "Founding Member #N · Premium till …", Profile shows "Founding Member".
- Server: `GET /api/founder` (spots), `POST /api/founder/claim` (atomic counter — never more than the limit, one per number),
  gives Premium days on the number (`subscriptionExpiry` / `subscriptionDays`, same fields as redeem codes) and marks `founder` on the customer.
- Admin → Home Settings → "Free Premium offer": on/off, number of spots (1000), days (365). Offer off or full → normal plans page again.

## SMS provider: msgcherry
- OTP SMS now goes through msgcherry (`https://api1.msgcherry.com/fe/api/v1/send?username=&apiKey=&from=&to=91…&text=&unicode=false`),
  picked automatically when `SMS_BASE_URL` contains msgcherry (or `SMS_PROVIDER=msgcherry`). Old smscloud still works if its URL is set.
- GG_ENV: `SMS_USER=GUTARGOO`, `SMS_AUTH_KEY=<msgcherry apiKey>`, `SMS_SENDER=GUTRGO`, `SMS_BASE_URL=https://api1.msgcherry.com/fe/api/v1/send`.
- Text = their DLT template exactly ("Your One Time Password(OTP) is … Do not share it with any one. …"); `SMS_TEXT` can override ({otp}).

## Safety against bad API replies (from the AI Studio/Gemini report)
- Website never crashes on a non-list reply: `toList` guard for movies, series, sections, banners, categories, continue watching;
  section items accepted as `[{_id,type}]` or `{ movies, webseries }`; genres / seasons / episodes / cast guarded in `lib/content.ts`.
- Phone and desktop Continue Watching use separate caches (they store different shapes).
- NOT copied: an error handler that answers `success: true` with empty data when the database is down — that hides outages
  (the app would show an empty catalogue as if nothing exists). The server keeps answering an honest error; the website shows "Try again".
- Login on iPhone: the screen is pinned to the visible area above the keyboard (no sliding under the status bar); posters hide while typing on short screens.

## GG_ENV check + server that explains itself
- `loadEnv` also accepts a value wrapped in quotes, literal `\n`, one squashed line, JSON; skips `GG_ENV` itself.
- Server starts even if the database is missing/down (keeps retrying). `/api/*` answers 503 "Server is starting up…" until connected.
- `/api/health` → `settings` (which settings are present — names only, never values; `GG_ENV: "N settings loaded"`)
  and `dbProblem` in plain words (wrong password / Atlas Network Access must allow 0.0.0.0/0 / bad MONGO_URI).

## Bottom nav animation
- One tab bar for all tabs (mounted once in `App.tsx`), so the white pill slides between Home · Search · Potli · My List · Profile like the design.

## UI/UX bug sweep (320 px, landscape, iPhone)
- Login: always reachable on short / landscape screens (small posters < 720 px tall, none < 520 px).
- Search header opaque; search box 16 px (no iPhone zoom). Home/Detail headers no longer see-through.
- Potli: "Watch now" card fits 320 px (ellipsis, poster hidden on tiny screens), tabs don't touch the sound icon,
  premium line shows the free offer instead of "Plans from ₹58", "Poster" label removed.
- Premium page: gold button really pinned to the bottom (portal; animated parents broke `position: fixed`).
- Player: technical source list hidden on errors (`?debug=1` shows it), gesture tip hidden on error, smaller Up next card,
  header "S1 E1 · title" (no "Ep 1" repeat). Episode list shows "Episode 3" instead of "3. Ep 3".
- Season switcher on its own row, 38 px buttons. Hero height capped to the screen. 44 px header buttons.
- Missing pictures → branded Gutargoo+ placeholder. Toast moves to the top on pages without the tab bar (no more covering Play), 2-line max.
- Profile labels never cut; hints shorten instead. Share falls back to copy on older browsers.
- Potli: Back always lands on the same clip, even after a full reload (remembers the clip id, waits for the full catalog, scroll anchoring off).
- Still open (small): /account and /help pages in the old style.

## Video error → real reason
- Player error screen now says "Video can't play right now" + **Reason: …** in plain words.
- New `GET /api/play-check?id=<bunny video id>` (works even while the DB is down, cached 1 min): asks Bunny's API for the video's status
  (uploading / processing % / encode failed / upload failed / deleted) when BUNNY_VIDEO_API_KEY + BUNNY_LIBRARY_ID are set,
  then fetches the playlist like the website does (403 = Bunny Security referrers/token, 404 = missing / wrong library, 5xx, unreachable, missing quality).
- If the server can play it, the reason points at the device: browser can't play the format / slow internet / network blocking. Offline is detected first.
- No play link at all: "Reason: no video file added yet" / "still processing on Bunny" / "Bunny couldn't process — re-upload".
- `?debug=1` on the page still shows the technical source list.

## Admin kicked back to login right after "Welcome back" (AI Studio preview)
- Cause: the hosting proxy (AI Studio preview / Cloud Run IAM) replaces the `Authorization` header with its own token → every request after login was 401.
- Fix: website + admin also send the login in `X-GG-Token`; the server reads that first. Tested with a simulated proxy.
- Admin login page now shows **why** you were signed out (server's message). A password-change time in the future no longer blocks all logins.
- Database address that doesn't exist (DNS ENOTFOUND) now explained in /api/health; retry logs are quiet (no error flood).

## Backup data while MongoDB is down (LIVE_API_URL)
- If our database isn't connected, the website's API calls go to the live app server (`LIVE_API_URL`, default `https://admin.gutargooplus.com`) —
  the server the Play Store / App Store app uses. Movies, series, play links, OTP login and Continue Watching keep working.
- Never sent there: `/api/auth/*` and `/api/admin/*` (admin panel needs our own database), file uploads.
- `/api/health` shows `dataFrom: backup: …` while this is active. Turn off with `LIVE_API_URL=off` in GG_ENV.
- Once MONGO_URI is fixed, everything automatically comes from our own database again.
- Tested in sandbox with a stand-in live server: home list, HLS playback, OTP login all through the backup.
