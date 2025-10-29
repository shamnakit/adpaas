# ADPAAS — SaaS MVP Starter (Next.js + Supabase)

> Starter โครงแอปตามสเปก: SaaS Multi-tenant, มีหน้า /org/select, /requests, /requests/new (4 ขั้น), /review/:id, /results/:id, /dashboard, /settings
> ยังไม่มีโค้ดเชื่อมต่อฐานข้อมูล (ปลอดภัยสำหรับเริ่มต้น)

## ใช้งาน
1) ติดตั้ง: `npm i`
2) คัดลอก `.env.example` เป็น `.env.local` และเติมค่า `SUPABASE_URL` / `SUPABASE_ANON_KEY`
3) รัน: `npm run dev` แล้วเปิด `http://localhost:3000`

## โฟลเดอร์สำคัญ
- `src/app/**` — App Router pages
- `src/lib/supabaseClient.ts` — ไคลเอนต์ Supabase (ฝั่ง client; placeholder)
- `src/styles/globals.css` — Tailwind base styles

## งานถัดไป (Sprint 1)
- ต่อ Auth (Supabase Auth) + Org Switcher → เก็บ `org_id` ใน context
- ใส่ RLS จริงฝั่ง DB แล้วเรียกใช้ผ่าน RPC/filters จากแต่ละหน้า
- Implement Score/Readiness และ Export .xlsx (Edge Function หรือ API Route)
- เชื่อม presets/thresholds/keyword library ต่อองค์กรใน `/settings`
