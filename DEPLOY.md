# Deploy — gutargoo-one (website + admin panel + API, ek server)

## Settings: sirf ek secret — `GG_ENV`
Deploy pe (Google AI Studio / Cloud Run → Secrets / Environment variables) **ek hi** secret banao:

- Naam: `GG_ENV`
- Value: `GG_ENV.example.txt` ki poori list, apni values bhar ke (har line `KEY=value`).

Server start hote hi saari settings isi se load hoti hain (log mein `✅ GG_ENV: N settings loaded` aata hai).
- Alag-alag purani keys bhi chalengi, par **GG_ENV jeetega** — isliye badalna ho to sirf GG_ENV mein badlo.
- Agar secret box sab ek line mein kar de, tab bhi chalega (`KEY=value KEY2=value2`). JSON `{"KEY":"value"}` bhi chalta hai.
- `PORT` mat daalo — Cloud Run khud deta hai.
- Store links (`PLAY_STORE_URL`, `APP_STORE_URL`) bhi GG_ENV se — rebuild ki zaroorat nahi.
- Pehli baar admin: `ADMIN_EMAIL` + `ADMIN_PASSWORD` daalo, login karo, phir dono lines hata do.

⚠️ GG_ENV mein secrets hain (MongoDB, Bunny, SMS, JWT) — ye text kisi ko mat bhejna, GitHub pe mat daalna.

## Steps
1. Backup: MongoDB snapshot.
2. Zip upload / deploy (AI Studio) → build `npm run build`, start `npm start` (package.json mein already).
3. Test:
   - `https://<site>/api/health` → `"app":"gutargoo-one"`
   - `https://<site>/` phone pe → Potli khulega, ek movie chalao
   - `https://<site>/admin` → login → Dashboard → **Video playback test** hara hona chahiye
4. Bunny: Stream → library → **MP4 Fallback ON**; webhook `https://<site>/api/bunny/webhook`.

## Admin se control (website pe turant)
Home Settings: banners kitne, auto-slide time, Continue Watching on/off, Top 10 on/off, Potli "Watch now" kitne second baad.
Section Builder = Home ki rows; Hero Banners = upar ka carousel (phone picture alag de sakte ho).

## Mobile app
Flutter app ka API wahi hai (`/api`), keys/format same — app ko kuch badalna nahi.
