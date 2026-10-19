# Note for AI tools (Google AI Studio / Gemini) and developers

This project is LIVE. The Gutargoo+ Android and iOS apps read the same API and database.

Do NOT change, rename or remove — even for small UI requests:
1. Anything in `server/lib/format.js` (the mobile app reads these exact JSON keys).
2. API paths in `server/server.js` and `server/routes/*` (the mobile app calls them).
3. Login / security: `server/middleware/authMiddleware.js`, `server/middleware/rateLimit.js`, `server/routes/auth.js`, `server/controllers/otpController.js`.
4. Bunny video upload: `src/admin/lib/bunnyUpload.ts`, `server/services/bunnyService.js`.
5. `npm start` = `node server/server.js` (serves /api, the website and /admin on PORT).

Structure: `server/` = API, `src/viewer/` = public website (/), `src/admin/` = admin panel (/admin).
Aliases: `@/` = src/admin, `@v/` = src/viewer.
Secrets come from environment variables (see `.env.example`), never from files in the repo.
If a requested change seems to need one of the items above, stop and ask the owner first.

## Install app (PWA) — don't break
- `public/sw.js` must stay at the site root and must never cache `/api`, `/stream`, `/storage`, `/admin`. Bump its `VERSION` when you change it.
- Keep `public/manifest.json` and the `<link rel="manifest">` in `index.html`.

## Desktop / TV layout — keep both
- Phones use the mobile-app UI; screens >= 768px wide and >= 500px tall use `src/viewer/components/desktop/*` (see `useIsDesktop`). When changing a page, keep both branches working.
- Don't remove `SpatialNav` (TV remote arrow keys) or the `data-player` / `data-tv-start` attributes.

## API address
- Website and admin always call this same server's `/api` (see `serverReady` in src/admin/lib/api.ts and src/viewer/lib/api.ts). Do not hardcode another backend URL. Keep `/api/health` returning `app: "gutargoo-one"` and the `/stream` proxy in server/server.js.
