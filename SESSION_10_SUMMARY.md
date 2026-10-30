# Session 10 — Movie chalana (sabse pehle) + website UI/UX + admin

## Movie / trailer kyun nahi chal rahe the, kya kiya
Player sirf ek raste se video laata tha; woh fail = "This video couldn't be played".
Ab ek ke baad ek 4 raste try karta hai (user ko pata bhi nahi chalta):
1. iPhone/Safari pe seedha original link (admin.gutargooplus.com/stream — Safari pe browser block nahi karta)
2. Website ka apna /stream raasta (server Bunny se laata hai)
3. Android Chrome ka khud ka player
4. Bunny ki MP4 file (play_720p / 480p / 360p) — **Bunny → Stream → library → Encoding → "MP4 Fallback" ON karna zaroori**
- Fir bhi fail ho to error ke neeche chhote akshar mein wajah dikhti hai (screenshot bhejna).
- Trailer bhi isi raste se.
- Server ka /stream ab Bunny ko site ka referer bhejta hai (Bunny "allowed referrers" ke liye). Zaroorat ho to `BUNNY_REFERER` set kar sakte ho.
- **Admin → Dashboard → "Video playback test" → Test now**: batata hai server Bunny se video la pa raha hai ya nahi (aur 403 aaye to Bunny security setting check karo).

## Website UI/UX
- Search box ke andar laal border (admin ka CSS website pe aa raha tha) → hata diya; placeholder saaf "Search movies, web series…".
- Har page ka header ek jaisa, spacing ek jaisi (16px), iPhone notch ke neeche sahi, faaltu khaali patti hatayi.
- Profile: guest ko bada button "Login / Sign up with mobile number". Login page "Login or Sign up" — naya user OTP se apne aap banta hai; pehli baar login pe "Aapka naam?" (Skip bhi).
- Errors (OTP limit, galat OTP, internet) saaf laal box mein.
- Movie page: description bada, Like/My List/Share barabar buttons, spacing theek, "Trailer not available" chhota.
- Banner "Watch Now" seedha movie chalata hai; banner image na mile to doosri picture.
- Desktop menu 768–1024px pe "TV Shows" kat raha tha → theek.

## Admin
- Banner: ab **website phone ke liye alag tall picture** daal sakte ho (optional). Banner image khaali ho to movie/series ka banner use hota hai.
- Naya video/trailer upload → purana link khud hat jaata hai (naya hi chalega).
- Upload ke beech internet gaya to ruk ke wapas chalu; "Processing" har minute khud check + "Check now" button; Dashboard pe "Check now" sab videos ke liye.
- Home sections: har style ka matlab likha; Top 10 mein 10 se zyada pe warning.
- Phone pe popup windows screen mein fit; Save button neeche chipka rehta hai.
- Category add/delete ke baad series form mein turant dikhti hai.

## Real testing round (whitebox + blackbox)
- `npm install`, `tsc --noEmit` (0 errors) and a real `vite build` on Linux all OK.
- Server run for real against a MongoDB-compatible DB (FerretDB) with a fake Bunny CDN/storage: 51/55 API checks passed.
  The 4 "failures": wrong OTP returns 200 + success:false (the app expects that), path test was a test-script quirk,
  and search $text / dashboard $ifNull aren't supported by FerretDB only (real MongoDB Atlas supports them).
- Real Chromium played: HLS movie (desktop + phone), MP4 fallback when the playlist is missing, custom link movie, trailer (desktop + phone).
  Broken video shows "This video couldn't be played" + Retry (no endless spinner). Hero "Play" plays. OTP login, wrong-OTP error,
  profile, continue watching, popup, admin login/reload/movie create/popup toggle (no logout) all OK.
- Fixes from this round: a movie/episode that only has a Bunny video id (no saved link) now still gets a play link
  (lib/format.js); admin "Video playback test" checks the newest 5 movies instead of 1 and is shown even if stats fail;
  phone detail page "My List" pill no longer wraps to two lines.
- Not testable from here: the live database and the live Bunny account (blocked network). Bunny "MP4 Fallback" ON is still recommended.
