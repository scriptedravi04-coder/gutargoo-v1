# Session 09 — Bug hunt round 2

## Mobile app (Flutter) ke saath server
- Check kiya: app ki har call server se match karti hai — kuch toota nahi.
- OTP limit bahut tight ho gayi thi (ek hi mobile network pe bahut log) → badhayi.
- Galat number daalne pe "valid number daalo" hi aata hai (pehle "too many requests").
- Profile mein number "+91 91…" double dikhta tha → theek.
- Purane users (number alag format mein save) ka dobara naya account nahi banega.
- Views ek hi aadmi ke baar-baar khulne se badh rahe the → ab ek aadmi ka ek title pe 6 ghante mein 1 view.
- Banner mein ek kharab entry poori banner list app mein gayab kar sakti thi → data saaf karke bhejte hain.
- Download: purane server pe /stream se hi (blocked networks ke liye), Cloud Run pe seedha Bunny se. `DOWNLOAD_VIA=cdn|proxy` se badal sakte ho.

## Server
- `ADMIN_RESET_PASSWORD=yes` chhoot jaye to bhi baar-baar logout nahi.
- Cast & Crew ki photo badalne/hatane se movies ki photo nahi tootegi.
- Bunny ka thoda error aaye to videos "Failed" nahi ho jayenge.
- Series ka trailer hatane pe khaali trailer button nahi.
- Video proxy crash-safe; galat token pe 401; dashboard ke series/episode count sahi.
- Banner bina movie/series ke save nahi hoga (pehle chupchaap gayab ho jaata).
- Video delete karne se pehle movies + series dono mein check.

## Admin panel
- "More options" band karne se trailer upload cancel / Save atak jaata tha → theek.
- Upload ya save ke beech sidebar link / browser Back → ab warning; save chal raha ho to video delete nahi hota.
- List se publish karke form kholo to purana status nahi dikhega.
- Badi photos browser mein hi chhoti ho jaati hain (413 error nahi aayega).
- Phone pe Save bar browser ke toolbar ke neeche nahi chhupta.
- Purane Safari pe "Publish" draft ban jaata tha → theek.
- Popup off message, Users "custom days" Enter, Section limit, image × keyboard se.

## Website
- Video link fail ho to spinner hamesha ghoomta tha → ab error + Retry.
- Retry ab wahi se chalta hai jahan ruka tha; player pause karke peeche le jao to aage nahi kudta.
- Purana `?t=` galat episode pe nahi lagta.
- "Coming Soon" admin ke edit karne se nahi aata — sirf jab video sach mein Bunny pe process ho raha ho.
  (Isliye Bunny webhook zaroor lagao: `https://<site>/api/bunny/webhook` — warna naya video "Ready" hone mein der lagegi.)
- Continue Watching row player se wapas aate hi update.
- Chhoti oonchai wali wide window mein grid sahi.
