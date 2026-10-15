# Gutargoo+ — ek hi project (Ybex jaisa)

Website + admin panel + server — teeno **ek hi code, ek hi server** pe. Mobile app (Flutter) bhi isi folder mein hai.

```
gutargoo-one/
├── server/        API (Node + Express + MongoDB) — mobile app, website aur admin teeno isi se baat karte hain
├── src/
│   ├── viewer/    Website (mobile app jaisi) → gutargooplus.com/
│   ├── admin/     Admin panel                 → gutargooplus.com/admin
│   └── main.tsx   /admin ho to admin, warna website
├── public/        Logo, icons, images
├── app/           Android + iOS app (Flutter) — alag build hota hai
└── .env           Saari settings ek jagah (zip mein nahi, .env.example dekho)
```

## Chalana

```bash
npm install
cp .env.example .env        # asli values bharo
npm run build               # website + admin ban jaate hain (dist/)
npm start                   # server: API + website + admin, sab ek port pe (3001)
```

- Website: `http://localhost:3001/` · Admin: `http://localhost:3001/admin` · API: `http://localhost:3001/api/health`
- Development: ek terminal mein `npm run dev:server`, doosre mein `npm run dev` → `http://localhost:8080` (aur `/admin`).
- Pehla admin / password reset: `npm run create-admin -- you@email.com "Password123" "Name"`
- Database jaanch (kuch nahi badalta): `npm run check-db`

## Docs
- `ARCHITECTURE.md` — kaunsa kaam kis folder mein
- `DEPLOY.md` — server pe kaise daalna hai
- `server/API.md` — saare API raste
- `UI_SPEC.md` — website ka design (mobile app se nikala)
