# Deploy — gutargoo-one (ek server pe sab)

> ⚠️ Ye code yahan chala ke test nahi hua (network nahi tha). Pehle test server / naye port pe chalao.

## Kya hai
Ek Node process: `/api` (mobile app + website + admin), `/` (website), `/admin` (admin panel). Vercel ki zaroorat nahi.

## Steps
1. **Backup:** abhi wala backend folder copy, MongoDB snapshot.
2. Server pe folder daalo → `npm install` → `.env.example` se `.env` (purani backend `.env` ki values + ye naye):
   - `BUNNY_STREAM_PUBLIC_BASE=https://admin.gutargooplus.com/stream`
   - `BUNNY_STORAGE_PUBLIC_BASE=https://admin.gutargooplus.com/storage`
   - `VITE_API_URL=/api`, `VITE_BACKEND_URL=/api`
3. `npm run check-db > db-before.txt` (sirf padhta hai) — output bhejo.
4. `npm run build` → `PORT=3002 npm start` → test:
   - `http://<server>:3002/api/health`
   - `http://<server>:3002/` website, ek free movie chalao
   - `http://<server>:3002/admin` login, movie edit-save
5. Theek hai to live: pm2 mein purane backend ki jagah ye (`pm2 start npm --name gutargoo -- start`), port wahi (3001).
6. **nginx:** `admin.gutargooplus.com` already is server pe aata hai — `/stream` aur `/storage` proxy **waise hi rehne do**. `gutargooplus.com` ko bhi isi server (port 3001) pe point karo jab website live karni ho.
   - Abhi gutargooplus.com pe purani website hai (VIP waitlist, `landing.html`, `admin.html`) — rakhni ho to un files ko `public/` mein daal do.
7. Purana Vercel admin band kar do (ab admin `gutargooplus.com/admin` ya `admin.gutargooplus.com/admin` pe hai).

## Live ke baad (admin panel se)
- Admin password badlo; anjaan admin accounts hatao (Settings).
- Section Builder: "NAME", "HELLO" test sections delete; order set karke save.
- Demo web series "The Boys", "Stranger Things" delete.
- "VITHI EN3" / "UDD JA RE" mein se ek ka video dobara upload.

## Bunny dashboard
- Stream → Webhook URL: `https://admin.gutargooplus.com/api/bunny/webhook`
- Encoding → MP4 Fallback: ON (app downloads ke liye)
- Allowed referrers laga ho to website domain add karo; nginx `/stream` pe CORS (`Access-Control-Allow-Origin: *`) ON (website video ke liye).

## Mobile app
Koi change nahi — wahi `admin.gutargooplus.com/api` use karta hai.
