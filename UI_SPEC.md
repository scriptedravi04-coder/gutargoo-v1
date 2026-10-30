# Gutargoo+ Web UI Spec

Source: Flutter app at `/home/claude/src/main/gutargoo-main-main/lib`.

All numbers are Flutter's scaled units on a 375×812 design (`ScreenUtilInit designSize: Size(375,812)`). On web, use them as px inside a mobile frame about 375–430px wide.

> **Where the brief and the code differ**
> - **"+ Watchlist" under posters is not on the Home screen.** Home posters are bare images. That button only appears on the **player screen**, in the "Similar Videos" / "Trending Videos" and "EXPLORE MORE" rows below the video (section 6).
> - **The details-screen hero is the trailer playing**, not a still image with a play icon. It autoplays, starts muted, and the play/pause icon is an overlay that hides after 3 s.
> - **Watchlist / My List / Favorites are not saved anywhere.** They live only in memory and are lost when the app restarts. Recent searches, the Like state, mute and login state *are* saved on the device.

## 1. Global

### Colors (`lib/uitls/colors.dart` plus inline values)
| Token | Hex | Use |
|---|---|---|
| bg | `#0E0E0E` | bottom nav, Favorites screen. Most screens actually use **`#000000`** (Home sections, Details, Search, Profile, View All) |
| bg-alt | `#0A0A0A` | Help & FAQ and Privacy Policy pages |
| surface | `#16171C` | text-field fill |
| card | `#1A1A1A` | login inputs, search result cards, dialogs |
| card-2 | `#1E1E1E` / `#121212` | Edit Profile fields / page |
| orange (accent) | `#F97316` | active tab, "View All", "Clear All", Send OTP and Verify buttons, focused OTP box |
| primary red | `#F64136` | defined in the code but rarely used |
| IMDB label | `#FFA500` | |
| link blue | Material blue `#2196F3` | "Read More", "Terms & Privacy Policy" |
| greys | `#8E8E8E` hint, `#6B6B6B` grey, `#404040` border, Material grey `#9E9E9E` for meta text and dots, grey.shade400 `#BDBDBD` for description |
| white alphas | white24 = `rgba(255,255,255,.24)` (outlines), white10, white12, white38, white54, white60, white70 | |
| placeholders | grey.shade800 `#424242`, shade900 `#212121` | shimmer runs `#212121` → `#424242` (or `#616161`) |

### Gradients
- **Play button:** vertical (top to bottom) `#9E1119 → #DF4119 → #9E1119`, radius 8.
- **Go Pro pill:** `#FFD700 → #FFA500` running top-left to bottom-right, orange glow shadow (blur 10, y 4, opacity .6). A white shine sweeps across it every 1 s.
- **Premium popup:** card `#2A0A0A → #1A0505`. Icon and CTA `#B91C1C → #EF4444`.
- **Help/Privacy cards:** `#0F0F0F → #1A0A0A` (top-left to bottom-right), border `rgba(155,8,8,.35)`, shadow `rgba(155,8,8,.2)` blur 14, y 6, radius 14.
- **Sign-out dialog:** `#0A2A4F → #000 → #2B0A3D`, radius 25. Accent `#F97316 → #EF4444`.
- **Theme yellow (unused):** `#FACC15 → #F97316`.

### Type
- No custom font. Use the system font (Roboto/Inter). The only exception is the **Impact** font for Top-10 rank numbers.
- Section header: 16 / bold / UPPERCASE.
- Detail title fallback: 22 bold.
- Body: 10–13.
- Bottom-nav labels: 12, w600 when selected, w400 otherwise.

### Radii
| Element | Radius |
|---|---|
| Posters | 6 |
| Banners, View All grid, Play/Download buttons | 8 |
| Continue-watching cards, inputs | 12 |
| Login fields, FAQ cards | 14 |
| Splash / login carousel cards, popup image | 20 |
| Category chips, Go Pro pill | 30 (full) |

### Icons (Material → lucide)
| Material | lucide |
|---|---|
| home_outlined | `House` |
| search | `Search` |
| favorite | `Heart` (filled) |
| person_outlined | `User` |
| play_arrow | `Play` |
| download_rounded | `Download` |
| thumb_up / thumb_up_outlined | `ThumbsUp` (filled when active) |
| add_outlined / check_circle | `Plus` / `CircleCheck` |
| share | `Share2` |
| arrow_back | `ArrowLeft` |
| arrow_forward_ios | `ChevronRight` |
| mic / mic_none | `Mic` |
| close | `X` |
| history | `History` |
| replay_10 / forward_10 | `RotateCcw` / `RotateCw` with a "10" label |
| settings | `Settings` |
| fullscreen | `Maximize` |
| lock_open | `LockOpen` |
| cast | `Cast` |
| skip_next | `SkipForward` |
| volume_off / volume_up | `VolumeX` / `Volume2` |
| bookmark_border | `Bookmark` |
| card_giftcard | `Gift` |
| help_outline | `CircleHelp` |
| privacy_tip_outlined | `ShieldCheck` |
| crown (FontAwesome) | `Crown` |
| workspace_premium | `Award` |
| info_outline | `Info` |

The Trailer pill uses the custom image `assets/t.png`, tinted white. lucide `Clapperboard` is a close substitute.

## 2. Navigation

### Bottom bar (`bottombar/bottom_screen.dart`)
- 4 fixed tabs: **Home** (house), **Search** (search), **Favorite** (filled heart), **Profile** (person).
- Icon 24. Background `#0E0E0E`. 1px top border `rgba(107,107,107,.2)`.
- Active tab is orange `#F97316`; inactive is white.
- Screens are kept alive when switching tabs (IndexedStack).
- Back on any non-Home tab goes to Home. On Home, a second back within 2 s exits ("Ek baar aur press karen bahar nikalne ke liye").

### Home top bar (scrolls away, not pinned)
- Left: wordmark **`assets/Bevel.png`** (white "GUTARGOO+" with the red bird-G), box 140×120, padding-left 10.
- Right: **Go Pro** pill. Max-width 100, min-height 23, padding 10×2, crown icon 11 + "Go Pro" 11 bold black.
- There is no search icon and no profile icon in the header.
- The bar background is the **dominant color of the current banner** (pixel average). It animates over 200 ms whenever the slide changes.

### Category chips (sticky, height 52)
- Labels: "Home" plus names from `GET /api/category`. Fallback list: `Home, Movies, TV Shows, Web Series`.
- Each chip: height 32, padding-x 14, gap 4, radius 30.
- Selected: background `white/15`, white text, w700. Unselected: `white/8`, `white/60`, w400. Font 14.
- Chip-bar background matches the banner color.
- **Filter behaviour:** "Home" shows everything. Any other chip filters banners by `categoryType` and filters items in each section by `item.type` (`movie`, `webseries`, `tvshow`). Sections left empty are hidden. If nothing is left at all, show every section unfiltered. Continue Watching appears only on "Home".

## 3. Splash (`splash/splash_screen.dart`)
- **Returning user:** black screen playing **`assets/logo.mp4`** (contained, 20px side padding). It hands off when the video ends, or after **5 s at most**, with a 300 ms delay and a 500 ms fade.
- **Destination:** Home if logged in, otherwise Phone Login.
- **First launch only:** an onboarding screen instead of the video.
  - Background gradient `#0D1B14` (0–50%) → `#000`.
  - Infinite carousel at 72% of viewport width, height 440. Images: img3.jpeg, 1.png, img4.png, awasaan_trailer.jpg, red_trailer.jpg. Radius 20.
  - Side cards: scale `1 − d·0.12` (min .85), rotate `d·−0.18 rad`, translateY `d·20`. Auto-advances every 3 s.
  - Dots: active 24×4 white, others 6×4 white30.
  - Headline **"Watch On\nAny Device Free"** (28 bold, line-height 1.25). Subline **"Discover unlimited entertainments"** (13, white54).
  - Bottom: swipe-to-unlock pill, height 62, radius 40, background white/7, border white/12. Centre text "Home >>>" with the arrows pulsing. The knob is `ic_launch.png` (bird-G, 50px).
  - Dragging past 88% goes to Home without login.

## 4. Home (in order)

1. **Hero banner carousel**
   - Height 450. Slides 96% of viewport width with 3px gaps. Infinite loop (clones at both ends).
   - **No autoplay, no dots.** The user swipes.
   - Each slide: radius 8, image `mobileImage` fit cover. Background parallax `offset × 230px`, foreground `× 20px`.
   - Overlay gradient top to bottom: `black/54 → transparent → black/87`.
   - Bottom stack (bottom 20, sides 20, centred):
     - logo image 220×40 (falls back to the title, 18 bold);
     - 2px gap;
     - info row: `language • genre • genre` (11 w500 white, letter-spacing .3; bullets white54 12);
     - 8px gap;
     - **white "Watch Now" button**: padding 18×10, radius 6, black play icon plus black text.
   - There is no Watchlist or Info button on the banner.
   - The area behind the carousel is a gradient from the banner color (0–30%) to black (70–100%).
   - Loading state: shimmer, height 420, radius 12.
2. **Continue Watching** (Home chip only, needs a token)
   - Title "CONTINUE WATCHING" 16 bold, padding 20×10.
   - Cards 180×110, radius 12, horizontal banner image (fill), gap 12. Overlay gradient `black/30 → transparent → black/50`.
   - Close button top-right: 6px padding, black/70 circle, white/20 border, X 16. It opens a "Remove from Continue Watching?" dialog (`#1A1A1A`, radius 16, Cancel outline / red Remove).
   - Bottom red progress bar, 3px, track black/50.
   - Tapping a card resumes in the player at `watchedTime`.
3. **Dynamic sections** (`GET /api/admin/sections/alllist`), 16px gap after each.
   - **Header:** padding 16×5. Title UPPERCASE 16 bold white on the left. Right side is the text **"View All"** in orange, 14 (no arrow). It opens View All.
   - Layout by `displayStyle`:
     - **default / `vertical_banner`:** row height 170. Poster 120×170, radius 6, gap 10, padding-left 15. No title under the poster.
     - **`horizontal_banner`:** row height 100. Card 180×100, radius 8, gap 10.
     - **`big_vertical`:** full-width pager, height 450. Image inset 31px each side, height about 400, radius 8, uses `bigVerticalUrl`. Dots below: 4px tall; active 24w white/60, others 8w white/40.
     - **`big_horizontal`:** no special case in the code, so it falls through to the standard poster row.
     - **`index_vertical` (Top 10):** max 10 items, row height 170, padding left 40 / right 30. Each item is 140w with a 50px right margin. Poster 120w at left 30 (top/bottom inset 5), radius 6, shadow black/70 blur 15 y 5.
   - **Rank number** sits behind the poster at left −30, bottom 5:
     - **Impact**, 145px, weight 900, line-height .82, letter-spacing −5.
     - Three stacked layers: a black stroke 12px, a `#212121` stroke 8px, then the white fill with text-shadows (black/90 blur 25 offset 3,3 and black/50 blur 15 offset 1,1).
     - On web, use `-webkit-text-stroke` with stacked spans.
   - Empty state: movie icon, "No content available", "Pull down to refresh". Pull-to-refresh refetches everything.
4. **Popup on open:** shown once per session if `GET /api/popups` returns an active popup with an image.
   - Backdrop black/82 with blur 2.
   - Image card at 2:3, margin-x 24, radius 20, border amber/55 1.5px.
   - Close button top-right: 32px black/60 circle, amber border and glow.
   - Animation: fade plus scale .9 → 1 over 300 ms.

**View All:** black page. Centred app bar title in UPPERCASE (17 w700, letter-spacing .8). Grid of 3 columns, aspect .65, gaps 8, radius 8. Each poster has its title underneath (11 w500, 2 lines, centred).

## 5. Details (`home/screen/details_screen.dart`)

Black background. The player stays fixed at the top and the content below scrolls.

- **Top area:** 16:9 trailer player. It autoplays HLS, starts muted, and the mute state is saved as `video_muted`. It shows a spinner (box height 220) until ready, or the text "Trailer not available".
  - Tap toggles controls: a centred black/54 circle with play/pause 36 (padding 18), which hides after 3 s.
  - Top-left: back arrow. Top-right: "Trailer" (12 w800 white60).
  - Bottom-right: mute button (black/54 circle, icon 20).
- **Logo:** image 160×50, contained, centred. Falls back to the title at 22 bold.
- **Info row** (centred): **`IMDB 9.0`** in `#FFA500` 12 w800, then a 4px grey dot, then genres (grey 10), then "N Seasons" (series only), then the age rating (grey 10).
  - If there is no rating the code shows **"IMDB 8.6"**; if there is no age rating it shows **"U/A 16+"**.
- **Play button:** spacing 8, margin-x 20, full width, height 56, the red gradient above, radius 8, play icon 20 plus "Play" 20 w600.
  - Movie: opens the player.
  - Series: plays S1E1.
  - No URL: shows the "Movie/Web Series Coming Soon" dialog (`#1A1A1A`, orange clock icon, orange button).
- **Download button:** shown only when logged in. Margin-x 20, height 40, radius 8, background `#212121`, border white24, download icon 16 plus "Download" 18 w600.
  - Tapping it opens the **Premium "Coming Soon" popup** (see Go Pro below).
  - Other states: Downloaded `#1A7A3A` with a check; while downloading it shows the percentage with a progress fill.
- **Description:** margin-x 20, 10px grey.shade400, 3 lines. If it is longer than 100 characters, show **"Read More" / "Read Less"** in blue, 11 w500.
- **Action pills** (row, evenly spaced): padding 12×8, radius 6, background white/5, border white24 0.9px, icon 16 plus label 12 w500. Active state: red text, red border, red/20 fill.
  - **Trailer:** opens a fullscreen landscape trailer.
  - **Like:** stored locally only (`liked_genres` in prefs).
  - **My List:** in-memory favorites; icon switches Plus → CircleCheck.
  - **Share:** shares the text "Download App: https://play.google.com/store/apps/details?id=com.gutargooproo.application".
- **Cast & Crew:** heading 14 w700. Row height 140, padding 16. Each item 70w with 12 gap: 60px circular photo, name 11 w600, role 9 grey.
- **Movie bottom:** "Explore More" (14 w600 **grey**, padding 20). Row of posters 120×170, radius 6, made from **every item in every home section, de-duplicated**. No Watchlist button here.
- **Web-series bottom:**
  - Tab bar **EPISODES | MORE LIKE THIS** (red indicator 3px, 14 w700 white / white38).
  - Season selector: text tabs "Season N" 15, selected white w700 with a 2.5px white underline, unselected white38, gap 24.
  - Episode item (margin 12×2, padding-y 10, bottom border white10):
    - thumbnail 130×80, radius 6, with a 22px black/54 play circle at bottom-left;
    - beside it: title 13 w600 (2 lines), description 11 white60 (3 lines), "Episode N" 11 white54.
    - No URL: orange "Coming Soon" overlay and badge.
  - The first 5 episodes show, then a "View More / View Less" pill (white10, radius 20).
  - MORE LIKE THIS: 3-column grid, aspect .65.
  - Note: for series the "logo" field is filled with the series' vertical poster.

## 6. Player (`home/screen/video_screen.dart`)

**Portrait layout:** 16:9 player on top. The list below shows "Similar Videos" or "Trending Videos" (16 w700), then **"EXPLORE MORE"** (16 bold).

- Cards in those lists: 110w, poster 110×170 radius 8, then a 6px gap, then the **Watchlist button**.
  - Full card width, padding 10×5 (8×5 in Explore More), radius 4.
  - Default: gradient white/8 → white/2, border white/20 0.8px, "+" 16 plus "Watchlist" 10 w600.
  - Added: green tint, border green/60, greenAccent check, "Added".

**Overlay controls** (auto-hide after 3 s):
- Centre: replay_10, play/pause, forward_10. Each is a black/65 circle, padding 12, icon 28, gap 28.
- Double-tap the left or right half to seek ±10 s, with a "10 sec" chip (black/55, radius 10).
- Top row: back, title (16 w700), Cast, Lock, Settings, Fullscreen.
- Bottom: red slider (track white24), then "mm:ss / mm:ss" (12 white70).
- Buffering: black/40 overlay with a red spinner.
- **Settings:** black sheet with tabs **Quality** (Auto plus 1080p/720p… parsed from the HLS master playlist) and **Speed** (0.5, 0.75, "1x Normal", 1.25, 1.5, 2). Selected row gets a blueAccent check.
- **Skip Intro:** bottom-right 20/20, pill gradient `#C1BDBD → #ECEAEA`, radius 30, black skip icon 15 plus "Skip Intro" 10 w600.
- **Next episode:** the same pill style at bottom-left, "Next: {title}" 12 w600, shown when 120 s or less remain.
- Fullscreen forces landscape. Mobile-only extras: drag up/down on the left half for brightness, right half for volume.
- **On web:** a hls.js player with the same overlay, `requestFullscreen` plus `screen.orientation.lock('landscape')` where supported, and the progress-save API.

## 7. Search (`search.dart/screen/search_screen.dart`)

Black page, padding 14×10, 50px top spacer.

- **Search bar:**
  - 36px back circle (`#212121`).
  - Field height 50, fill `#212121`, radius 12, no border, search icon 18 white54.
  - Hint is "Search " plus a typewriter effect cycling "Web Series..." / "Movies..." (80 ms per character, 1.2 s pause).
  - Suffix: mic (it turns red while listening) or X when there is text.
- **Empty query:**
  - **Recent Searches** (13 w600 white70) with "Clear All" in orange. Chips: `#212121`, radius 20, border white12, history icon plus text plus x. Up to 10, saved locally (`recent_searches`).
  - A divider, then **"Recommended for You"**: 3-column grid, aspect .65, radius 8, every movie from the home sections.
- **Results:** searches happen client-side across home-section movies (title, then genre, then description), debounced 300 ms.
  - Each result card: `#1A1A1A`, radius 12, 200-tall banner image.
  - Title 16 bold, then three round buttons: **Save** (outlined), **Detail** (outlined), **Play** (white circle).
  - Description 12 white70 (3 lines), genres 11 white38.
  - No results: "No results found for\n"q"".

## 8. Profile (`profile/screen/profile_screen.dart`)

Black page. App bar "Profile". Padding 16. Each row is a ListTile: white icon, white text, chevron 16.

| Section | Items |
|---|---|
| **APP SETTINGS** (grey) | My Account (person) → Edit Profile · **Watchlist** (bookmark) → My Favorites grid · **Redeem Code** (gift) → bottom sheet |
| **VIDEO SETTINGS** | Download Settings (download) → Premium Coming Soon popup |
| **SUPPORT** | Help & FAQ · Privacy Policy |

- Footer: **"Version: 1.0.0"**, grey, centred.
- There is no Go Pro widget, no delete-account option, and no logged-out variant on this page.
- **Sign out lives inside My Account (Edit Profile):**
  - Page `#121212`, title "Edit Profile", "Save" in orange.
  - Avatar 96 with a camera badge.
  - Fields: Phone (+91, or "You are Guest"), Email, Age.
  - Bottom button: logged in = red "Sign Out" (red/8 background, red/50 border). Logged out = green "Sign in with member".
  - Sign out shows the gradient dialog "SIGN OUT / Are you sure you want to sign out? / Cancel / Sign Out".
- **Favorites tab / screen:** title "My Favorites". 3-column grid, aspect .8, gaps 16, radius 6. Each item has a red heart in a black/54 circle that removes it. Empty state: "No Favorites yet".
- **Redeem sheet:** `#1A1A1A`, "Redeem Code", input "Enter your code", "Redeem" button, "View Available Codes" toggle, list rows with Use/Used.
- **Go Pro / Premium popup** (`custom/coming_soon_pro.dart`):
  - Badge "✦ COMING SOON ✦", title **"Unlock Premium"**, subtitle "Choose a plan that works for you".
  - Plans: **Monthly ₹199 / per month** and **Yearly ₹999 / per year** with a "Save 58%" badge. Both are locked under "Coming Soon".
  - Features: "Stream in 4K Quaily" (sic), "Download and watch offline anytime", "Completely ad-free streaming experience".
  - CTA **"Notify Me at Launch"**, footer "We'll notify you the moment it's live ✨".
- **Help & FAQ** (inline, not a webview): expandable cards, question 11 w600 `#F2F2F2`, answer 13 `#B5B5B5`, red chevron. Full text in section 12.
- **Privacy Policy:** inline text in `profile/screen/privacy_policy.dart` (about 6.6 KB file, 8 short sections). Each section is a card (same styling as the FAQ, padding 16, gap 12) with a title (11 w600 `#F2F2F2`) and body (13 `#B5B5B5`). Then "Last Updated: January 2026" (12, `#6B6B6B`, centred). Full text in section 11. (The same file also defines an unused `SettingsOptionsWidget` with Help & FAQ / Privacy Policy link cards; it is not shown on this page.)

## 9. Login (`profile/screen/auth/otp.dart`, `otv_verifie_screen.dart`)

**Phone screen:**
- Same green-black gradient and tilted carousel as onboarding: height 380, rotate .1, images img3, the_networker, img4, awasaan_trailer, red_trailer.
- **"Login with Mobile"** 18 bold.
- Field: `#1A1A1A`, radius 14, border white12, prefix 🇮🇳 **+91** (orange bold), hint "10-digit mobile number", digits only, max 10.
- **"Send OTP"** button: height 52, radius 12, orange `#F97316`. Disabled `#424242` with white38 text until 10 digits are entered.
- "By continuing, you agree to our **Terms & Privacy Policy**" (11 grey, link blue w600). The link opens https://gutargooplus.com/.
- `white_logo.png` at the bottom, 140×36.
- API: `POST /api/otp/send`.

**Verify screen:**
- Back arrow, carousel height 360.
- **"Verify OTP"** 18 bold.
- Read-only box "+91 XXXXXXXXXX" (15, letter-spacing 1.2).
- 6 OTP boxes, 46×52, `#1A1A1A`, radius 12, border white12. Focused box: orange 1.5px border. Completing all 6 auto-submits.
- Timer text "Expires in 05:00", counting down from **300 s**. It turns red under 60 s and reads "OTP expired" at 0.
- **"Resend OTP"** is enabled only after expiry (orange, otherwise grey.shade800).
- **"Verify & Continue"**: height 54, orange.
- "Change Phone Number?" (underlined grey), then the terms line.
- API: `POST /api/otp/verify`.

## 10. Brand strings and assets
- **Strings:** "Gutargoo+", "Watch On Any Device Free", "Discover unlimited entertainments", "Go Pro", support@Gutargooplus.com, gutargooplus.com, API base `https://admin.gutargooplus.com/api`.
- **Main logo:** **`Bevel.png`** (913×105, white wordmark with the red bird-G, used in the Home header).
- **Other brand images:**
  - `white_logo.png` (1696×195, white wordmark, login footer);
  - `ic_launch.png` (768², red bird-G mark only, swipe knob; use it as the favicon);
  - `qwerty.png` (1024², app icon: G mark plus "GUTARGOO+" on black);
  - `icon_foreground*.png`, `icon1024.png`, `splash_logo.png`, `Logo_gutargoo.png` (3086²), `mainlogo.png`, `splash.png` (942×446);
  - `logo.mp4` (splash animation).
- **Promo art:** img3.jpeg, 1.png, img4.png, the_networker.jpeg, awasaan_trailer.jpg, red_trailer.jpg.
- **Unused title logos:** awasaan_logo, red_logo, logo1–4, Logo6, Alien, thenetworking.

## Stored on the device
| Data | Storage |
|---|---|
| Login | `isLoggedIn`, `auth_token`, `mobile`, `userId`, `phoneNumber`, `user_email`, `user_age` |
| Onboarding seen | `is_first_time` |
| Recent searches | `recent_searches` |
| Like state | `liked_genres` |
| Trailer mute | `video_muted` |
| Watchlist / Favorites | **memory only, not saved** |
| Continue Watching | server (`/api/continue-watching`) |

On web, use localStorage for these. Persisting the Watchlist there would be an improvement over the app.

## 11. Privacy Policy full text

Verbatim from `lib/profile/screen/privacy_policy.dart`, in order. Page title: **Privacy Policy**.

**1. Information We Collect**
We collect information you provide directly, such as when you create an account or contact us. This includes name, email, and viewing preferences.

**2. How We Use Your Information**
We use your information to provide, maintain, and improve our services, send communications, and comply with legal obligations.

**3. Data Security**
We implement industry-standard security measures to protect your personal information. All data is encrypted during transmission and stored securely.

**4. Sharing Your Information**
We do not sell your personal information. We may share data with trusted service providers under strict confidentiality.

**5. Cookies and Tracking**
We use cookies and similar technologies to enhance your experience and analyze usage patterns.

**6. Your Rights**
You can access, update, or delete your personal information anytime by contacting support@Gutargooplus.com.

**7. iOS Subscription & Payment**
Gutargoo+ does not offer paid subscriptions on iOS. All content is free.

**8. Contact Us**
For support, contact us at Support@Gutargooplus.com

Last Updated: January 2026

## 12. Help & FAQ full text

Verbatim from `lib/profile/screen/help_faq.dart`, in order. Page title: **Help & FAQ**.

**What type of content is available on Gutargoo+?**
Gutargoo+ offers self-produced movies as well as officially licensed movies available for streaming.

**What should I do if I don’t receive the OTP?**
Please check your network connection and try the “Resend OTP” option. If the issue continues, try again after some time.

**How do I contact customer support?**
You can reach our support team via email at support@Gutargooplus.com.

**How can I use Gutargoo+?**
Download the app, enter your mobile number, verify using OTP, and start streaming.

**How can I improve video quality?**
Go to Player Settings > Video Quality and select your preferred quality.
