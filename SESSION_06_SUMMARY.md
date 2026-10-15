# Session 06 — Desktop / TV website + install/download + "dummy" cheezein theek

## Kya naya hai
**Laptop / desktop / TV pe ab poori website layout** (phone pe wahi app wala UI):
- Upar menu: Home · Movies · Web Series · TV Shows · My List, Search, **Install**, **Download App**, **Full screen (TV mode)**, Sign In / Profile.
- Home: poori width ka bada banner (8 sec mein badalta hai), Play / More Info / My List. Neeche admin ke sections wali lambi rows (bade posters, Top 10 numbers, landscape cards), arrows se scroll. Footer.
- Movie / Series page: bada background, title, info, Play, Trailer (popup mein), My List / Like / Share, episodes grid (season tabs), Cast, More Like This.
- Player page: bada player (screen mein fit), neeche title/info, episodes, Similar + Explore rows.
- Search, View All, My List: bada grid. Profile / Account / Help: beech mein saaf column. Login: do column.
- Popups (Premium, Coming Soon, Redeem, Install) desktop pe beech mein.

**TV pe chalana:**
- TV ke browser mein site kholo. Remote ke ← ↑ → ↓ se cards/buttons pe chalo, OK se kholo, Back se peeche.
- Player page: ← → = 10 sec aage/peeche, OK = play/pause.
- Bade TV (1600px+) pe sab apne aap bada dikhta hai.
- Menu ka Full screen button = TV jaisa poora screen.

**Install / Download:**
- Desktop menu mein Install (Chrome/Edge mein ek click, baaki browser mein steps dikhata hai) aur Download App (Play Store).
- Phone Home header mein chhota Install button, Profile mein "Install Gutargoo+ on this device".
- Movie download (offline) sirf mobile app mein hai — Help mein likh diya.

## Jo dummy / aadha kaam tha, theek kiya
- Naya episode jo abhi Bunny pe process ho raha hai — pehle Play dikhta tha phir error. Ab "Coming Soon".
- Like ab server pe save (movies, login ke saath) — app wala hi system. Pehle sirf phone mein.
- My Account: naam ab server se aata hai, Save fail ho to error dikhata hai (pehle hamesha "Saved"). Guest ke liye form band. **Delete my account** add (Play Store ke liye zaroori).
- Sign out pe pichhle user ka naam/email saaf.
- Continue Watching mein ab web series ka episode bhi aata hai (aur guest ki movie bhi) — is device pe.
- OTP: Resend 1 min baad (pehle 5 min wait), "Too many attempts" ke baad turant resend.
- Redeem success pe likha aata hai ki premium fayde mobile app mein milenge.
- Trailer na chale to Trailer button nahi dikhta.
- Help FAQ website ke hisaab se (TV, download, quality).
- Popup pe admin link daale to click karke khulta hai.
- "Favorite / Watchlist / Save" sab jagah ek naam: **My List**.
- Home ka category (Movies/Series) ab URL mein — View All bhi usi category ka dikhata hai.
- Top 10 horizontal style bhi number ke saath.
- Phone ghuma ke landscape karo to bhi mobile layout hi rehta hai; video fullscreen mein layout nahi badalta.

## Abhi bhi dhyan dene wali baat (code nahi badla)
- **Paid video link khula hai:** server paid movies ka video link bhi sabko bhejta hai (lock sirf dikhawe ka). Koi tech wala browser se paid movie chala sakta hai. Theek karne ke liye backend + app dono test karne padenge — developer se baat karni hogi.
- App Store link nahi mila — `.env` mein `VITE_APP_STORE_URL` daal do to iPhone walon ko App Store button dikhega.

## Files (naye)
`src/viewer/components/desktop/*` (TopNav, Footer, Rows, DesktopHero, DesktopHome, DesktopDetail, SpatialNav), `src/viewer/hooks/useIsDesktop.ts`, `src/viewer/hooks/useEscape.ts`.

## Admin panel login (naya server pe)
- Address: `https://<aapka-domain>/admin` (AI Studio pe: `https://<run.app link>/admin`).
- Purana admin email/password hi chalega (same MongoDB).
- Na chale / password yaad nahi: AI Studio settings mein do secrets daalo `ADMIN_EMAIL` aur `ADMIN_PASSWORD` (8+ characters) → app ek baar restart/redeploy → `/admin` pe login → **dono secrets hata do**. Login ke baad Settings se password badal sakte ho.
- Detail page pe title/Play ab banner ke neeche wale hisse mein (Episodes ke theek upar).
