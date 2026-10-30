# Session 05 — website ko phone pe "Install" karna (Ybex jaisa) + app jaisa splash

## Kya naya hai
- **Install app**: website kholne ke ~6 second baad neeche banner aata hai, "Install Gutargoo+ App".
  - Android / laptop Chrome: Install dabao, ek tap mein phone pe icon aa jaata hai. Full screen khulta hai, address bar nahi dikhta.
  - iPhone: Install dabane pe guide khulti hai, "Share → Add to Home Screen → Add".
  - Banner X karne pe 7 din tak dobara nahi aata. Profile → GET THE APP mein bhi "Install this web app" hai.
  - Install ho jaane ke baad banner/row apne aap gayab.
- **Splash bilkul app jaisa** (`app/lib/splash/splash_screen.dart` jaisa):
  - Pehli baar kholne pe "Watch On Any Device Free" screen, ghoomte posters, neeche "Home >>>" swipe karke andar.
  - Uske baad har baar logo video (installed app kholne pe bhi).
- **Service worker** (`public/sw.js`): site jaldi khulti hai, net na ho to "No internet" page.
  **Ye kabhi cache nahi karta:** `/api`, `/stream`, `/storage`, `/admin`, videos. Movies, login, admin hamesha server se live.

## Files
| File | Kya |
|---|---|
| `public/sw.js` | service worker (naya). Isme badlo to upar `VERSION` badha dena |
| `src/pwa.ts` | install event + service worker register (naya) |
| `src/viewer/components/InstallPrompt.tsx` | install banner + iPhone guide (naya) |
| `src/viewer/components/home/Welcome.tsx` | pehli baar wali swipe screen (naya) |
| `src/viewer/components/home/Splash.tsx` | welcome ya logo video chunta hai |
| `src/viewer/pages/Profile.tsx` | "Install this web app" row |
| `public/manifest.json`, `index.html`, `server/server.js` | chhote changes (manifest id/scope, black start, sw.js no-cache) |

## Check
- Chrome installability check pass (koi error nahi), service worker test: `/api` cache nahi hota, offline page aata hai, `/admin` ko haath nahi lagata.
- Install sirf **https** pe chalta hai (live domain / run.app — dono https hain).
- Test: Android Chrome → site kholo → 6 sec → banner → Install. iPhone Safari → banner → guide.

## Installed app ke liye extra (glitch se bachne ke liye)
- Naya page hamesha upar se khulta hai; Back dabao to wahi jagah wapas aate ho jahan scroll kiya tha (`ScrollManager.tsx`).
- Update (deploy) ke baad jo app khula pada tha woh blank nahi hoga, khud ek baar reload ho jaayega (`src/lazyPage.ts`). Koi page crash ho to "Reload" button (`ErrorBoundary.tsx`).
- Server: missing `/assets` / `/img` file pe ab sahi 404 (pehle index.html jaata tha).
- Installed app mein upar-neeche "rubber band" uchhal nahi, photo pe long-press menu nahi.
- iPhone pe text box tap karne pe page zoom nahi hota. Neeche ki tab bar iPhone ke home bar ke upar sahi baithti hai, toast bhi.
- Pehli baar wali swipe screen landscape mein bhi scroll ho jaati hai.
- iPhone note: Home Screen wala app Safari se alag hota hai, wahan ek baar login dobara karna padega (iPhone ka rule).
