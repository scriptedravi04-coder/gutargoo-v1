# Kaunsa kaam kis folder mein (gutargoo-one)

| Kya badalna hai | Folder | Live kaise hoga |
|---|---|---|
| Data / video link / login / permission | `server/` | Server restart — website, admin **aur mobile app** sab turant theek |
| Admin panel ka koi page | `src/admin/pages/…` | `npm run build` + restart |
| Website ka koi page | `src/viewer/pages/…` | `npm run build` + restart |
| Mobile app ka look / player | `app/lib/…` | Naya version Play Store + App Store pe |

## Website (`src/viewer/`)
| Screen | File |
|---|---|
| Home | `pages/Home.tsx`, `components/home/*` |
| Movie / series detail | `pages/MovieDetail.tsx`, `pages/SeriesDetail.tsx`, `components/detail/*` |
| Player | `pages/Watch.tsx`, `components/player/*` |
| Search, Favorite, Profile, Login, Help, Privacy | `pages/*`, `components/profile/*` |
| Data | `hooks/useCatalog.ts`, `lib/api.ts`, `lib/content.ts`, `lib/config.ts` |

## Admin (`src/admin/`) — address `/admin/...`
| Page | File |
|---|---|
| Dashboard | `pages/Dashboard.tsx` |
| Movies | `pages/movies/*`, `components/movies/*` |
| Web Series / TV Shows | `pages/series/*`, `components/series/*` |
| Banners, Sections, Popup, Home settings | `pages/HomeBanners.tsx`, `pages/HomeSections.tsx`, `pages/Popups.tsx`, `pages/HomeSettings.tsx` |
| Users, Redeem, Ads, Plans, Vendors, Settings | `pages/*.tsx` |
| Video upload seedha Bunny pe | `lib/bunnyUpload.ts`, `components/common/VideoUploadField.tsx` |

## Server (`server/`)
| Folder | Kya hai |
|---|---|
| `server.js` | Saare API raste + website/admin files serve karna |
| `routes/`, `controllers/` | API ka kaam |
| `models/` | Database ka shape (MongoDB — tables/migration nahi) |
| `lib/format.js` | **Mobile app jo JSON padhta hai — key names mat badlo** |
| `services/` | Bunny (video/image), video status auto-update |

## Pehchaan ke aliases (code mein)
- `@/…` = `src/admin/…` · `@v/…` = `src/viewer/…`

## Secrets
`.env` (MongoDB, Bunny, SMS, JWT) aur Play Store signing key (`app/android/key.properties` + `.jks`) — zip mein kabhi nahi.

## Phone pe install (PWA) — Session 05
- `public/sw.js` service worker, `public/manifest.json` naam/icon, `src/pwa.ts` install logic, `src/viewer/components/InstallPrompt.tsx` banner + iPhone guide.
- Service worker `/api`, `/stream`, `/storage`, `/admin` ko kabhi cache nahi karta. `sw.js` badlo to uska `VERSION` badhao.
- Splash: `src/viewer/components/home/Splash.tsx` (pehli baar `Welcome.tsx` swipe screen, baad mein logo video).

## Desktop / TV layout — Session 06
- 768px+ chaudi aur 500px+ oonchi screen = big-screen layout (`src/viewer/hooks/useIsDesktop.ts`). Phone (landscape bhi) = mobile UI.
- Big-screen hisse: `src/viewer/components/desktop/` — TopNav (menu, Install, Download App, Full screen), Footer, Rows (cards/rows/grids), DesktopHero, DesktopHome, DesktopDetail (movie/series page + episodes), SpatialNav (TV remote ← ↑ → ↓ / OK / Back).
- Har page mein `useIsDesktop()` se desktop wala hissa chunta hai; data/API same hai.
- `AppShell`: `wide` = poori width, `overlay` = menu banner ke upar tairta hai.
