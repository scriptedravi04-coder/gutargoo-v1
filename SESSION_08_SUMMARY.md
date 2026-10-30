# Session 08 — Poora project bug hunt (admin + server + website)

Teen hisson mein check kiya, ~60 cheezein mili, theek ki. Mukhya:

## Admin panel
- Ads: position badalne pe purana "start/mid/end" laga reh jaata tha → app extra ad chalata tha. Theek.
- Image upload fail ho to bhi "Saved" aata tha. Ab saaf error.
- Series/episode video upload ke beech page band/back → ab warning.
- Movie list mein Draft / Scheduled / Expired / Live sahi dikhta hai; publish switch scheduled date nahi mitata.
- Bade save timeout pe duplicate ban jaata tha → lamba time + "list refresh karke dekho" message.
- Naya video daalne pe purana "video link" chalta rehta tha → ab naya video chalega.
- Logo / card image / episode image hata sakte ho (× button).
- Cancel / fail / undo kiye video Bunny se apne aap delete (paisa bachega). Purani images bhi replace pe delete.
- Banner jiski movie live nahi → "Hidden – linked content not live".
- Dashboard "aaj" India time ke hisaab se. Users search "+91…" se bhi.
- Episode date khaali kar sakte ho; date ek din peeche nahi dikhegi.
- Subscription feature mein comma ("HD, no ads") ek hi rehta hai.
- Logout pe pichle admin ka data saaf. Password badalne ke baad bhi login bana rehta hai.

## Server
- Database thoda atke to app/website users logout nahi honge (503).
- OTP double tap pe error nahi; ek OTP ek hi baar chalega.
- Redeem code account delete karke dobara use nahi hoga; decimal value pe crash nahi.
- Account delete pe uska continue-watching/likes bhi saaf.
- Like button: galat id pe crash nahi, double tap safe.
- Upload: sirf jpg/png/webp/gif (SVG band — security), size limits; temp files sahi time pe saaf.
- Rate limit (OTP/login) ab saare server copies mein milke ginta hai (MongoDB).
- `ADMIN_EMAIL/ADMIN_PASSWORD`: ab sirf naya admin banata hai. Purane admin ka password reset karna ho to saath mein `ADMIN_RESET_PASSWORD=yes`.
- Bunny video status: Cloud Run pe timer bharosemand nahi → `POST /api/bunny/sync` (header `x-sync-key` = `SYNC_KEY`) Cloud Scheduler se har 5 min chala sakte ho. Bunny webhook bhi lagao.
- MP4 download links seedhe Bunny CDN se (Cloud Run se nahi guzarte).
- Movie dekhne se uska "updated" time nahi badalta (isi wajah se kuch movies web pe "Coming Soon" atak jaati thi).

## Website
- Purani movies jinka Bunny id nahi tha, "Coming Soon" pe atki thi → ab chalengi.
- Fullscreen mein next episode pe fullscreen nahi chhootega; TV mode mein player fullscreen sahi.
- Error ke baad Retry wahi se chalata hai; network 3 baar dobara try karta hai.
- Play button: guest ki movie wahi se, series pe "Resume S2 E4" ya pehla chalne wala episode.
- Tab band karne pe aakhri position save (keepalive).
- Landscape phone pe aadha-desktop layout nahi aata.
- Login mein "+91 98765 43210" paste karo to sahi number banta hai.
- Remote: player ke buttons pe ← → se focus chalta hai; settings Esc/Back se band.
- Seek bar drag smooth, quality list mein best bitrate, chhote player pe Skip Intro buttons ke upar nahi chadhta.
- Series list fail ho to "Some titles didn't load — Retry".

## Nayi settings (optional)
- `SYNC_KEY` — Cloud Scheduler wala video sync.
- `ADMIN_RESET_PASSWORD=yes` — sirf password reset karte waqt, phir hata do.

## Jaan-boojh ke nahi kiya
- Paid content lock (abhi sab free hai).
- Public movie list paging (app ka contract badal sakta hai).
