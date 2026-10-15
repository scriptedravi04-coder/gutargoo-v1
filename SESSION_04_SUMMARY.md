# Session 04 — gutargoo-one.zip (Ybex jaisa ek project)

## Kya hai
v6 ke saare hisse ek project mein jod diye:
- **Ek server** (`server/`) — API + website + admin, sab ek port pe.
- **Ek frontend build** — `src/viewer` (website, `/`) + `src/admin` (admin panel, `/admin`).
- **Ek `.env`, ek `package.json`, ek `npm install`.**
- Mobile app (`app/`) bhi isi folder mein; usme koi change nahi.

Code wahi hai jo v6 mein tha (naya backend, poora admin, web app) — sirf jagah badli:
- Admin ab `/admin/...` pe khulta hai (login `/admin/login`).
- Website aur admin ab server ka address khud use karte hain (`/api`), alag domain set karne ki zaroorat nahi.
- Server `dist/` se website + admin serve karta hai.

## Do options — ek chuno
| | v6 (alag-alag) | gutargoo-one (ek project) |
|---|---|---|
| Deploy | backend server + admin Vercel + web Vercel | sirf ek server |
| Developer ko | jaana-pehchana tarika | naya tarika, par simple |
| Aage kaam | 3 jagah | 1 jagah |

**Mera suggestion:** aage se `gutargoo-one` hi rakho (Ybex jaisa, ek jagah sab). Dono saath mein maintain karna mushkil hoga — developer ko ek hi dena.

## ⚠️
- Yahan chala ke test nahi hua (network nahi). Build-check pass. Pehle test port pe chalao (`DEPLOY.md`).
