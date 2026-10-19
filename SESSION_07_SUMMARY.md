# Session 07 — Admin logout, popup, video play, aasaan movie form

## Kya problem thi
- **Login ke baad 2 baar blink → logout, Popup publish → logout:** admin panel purane server (admin.gutargooplus.com) se baat kar raha tha (settings mein `VITE_BACKEND_URL` purana address tha). Purane server ka login token aur raste naye admin se match nahi karte → panel ko lagta tha login khatam → logout.
- **Website pe movie nahi chal rahi:** video ka link purane domain ka hai; naye domain (run.app) se browser use block kar deta hai (CORS).

## Kya theek kiya
- Admin aur website ab **hamesha apne hi server ka /api** use karte hain. `VITE_BACKEND_URL` / `VITE_API_URL` daalne ki zaroorat nahi (daale ho to hata do).
- Login page / Dashboard pe dikhta hai agar panel galat (purane) server se juda hai.
- Ek page error de to ab seedha logout nahi — pehle check hota hai login sach mein gaya ya nahi. Database thoda slow ho to bhi logout nahi.
- Dashboard pe **"Settings to check"** card: kaunsi setting (env key) missing hai — naam dikhata hai, value kabhi nahi.
- **Video:** server khud `/stream/...` se video chalata hai (purane server pe nginx karta tha). Bas setting `BUNNY_CDN_HOSTNAME` honi chahiye (Bunny → Stream → library → API mein "CDN hostname", jaise `vz-xxxx.b-cdn.net`).
  - Dhyan: is tarah video Google Cloud ke bandwidth se jaata hai (free limit ke baad paisa). Website ko baad mein usi server pe le jao jahan admin.gutargooplus.com hai, ya developer se nginx `/stream` pe `Access-Control-Allow-Origin: *` lagwa do — tab ye zaroori nahi.
- **Popup:** link mein website (https://…) ya app ka page (`/movie/<id>`) dono chalte hain.

## Movie add karna ab aasaan
- Sirf **title** zaroori. Baaki khaali chhodo to apne aap: language Hindi, age U/A 13+, saal is saal ka, description "Watch … on Gutargoo+.", length video se.
- Upar se order: **1. Video upload** (chalu ho jaata hai, baaki bharte raho) → **2. Details** (title, description, genre tap karke, language, age, length, saal) → **3. Poster + Banner** → Draft / Publish.
- Video chunte hi file ke naam se title aur video se length khud bhar jaati hai.
- Trailer, logo, cast & crew, skip intro, ads, download, schedule, SEO — sab **"More options (optional)"** mein band rehte hain.
- Length agar 1 min aa jaye (browser video padh na paaye) to Bunny ka video ready hote hi server khud theek kar deta hai — iske liye Bunny webhook lagana best hai: `https://<site>/api/bunny/webhook`.

## "Dummy data" ke baare mein
- Naye admin (`<site>/admin`) ka Dashboard asli database se numbers dikhata hai (users, movies, views = movies ke viewCount ka total). Koi nakli number code mein nahi hai. Purana Vercel wala admin panel hi dummy data wala tha — use band kar do.
