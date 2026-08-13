# ABM Web — Angular + Node/Supabase(Postgres) + Excel Export/Import

เว็บแอประบบเอกสารธุรกิจ (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน) ต่อยอดจาก POC เดิม (`abm_poc/`)
สถาปัตยกรรม: Angular (frontend) → Node/Express REST API (backend) → PostgreSQL ผ่าน Supabase (ฐานข้อมูลจริง)
พร้อมฟีเจอร์ Export/Import Excel (.xlsx) สำหรับให้ผู้ใช้ดาวน์โหลด/แก้ไขข้อมูลนอกระบบได้

## โครงสร้างโปรเจกต์

```
abm-web/
├── backend/            Node.js + TypeScript + Express + PostgreSQL (pg / Supabase)
│   ├── src/
│   ├── data/           schema.postgres.sql (สร้างตารางอัตโนมัติตอนรันครั้งแรก)
│   ├── pdf-service/     สคริปต์ python (weasyprint) สำหรับ render PDF ภาษาไทย
│   ├── fonts/           ฟอนต์ Sarabun
│   └── SUPABASE_SETUP.md  วิธีสร้าง Supabase project และเชื่อมต่อ
└── frontend/            Angular 18 (standalone components)
    └── src/app/
        ├── pages/customers, items, documents, document-form
        ├── services/api.service.ts
        └── models/models.ts
```

## รันบนเครื่องตัวเอง (ครั้งแรก)

### Backend
ต้องมี Supabase project และ connection string ก่อน — ดูวิธีสร้างละเอียดใน [`backend/SUPABASE_SETUP.md`](backend/SUPABASE_SETUP.md)

```bash
cd backend
cp .env.example .env        # แล้วใส่ DATABASE_URL จาก Supabase
npm install
npm run build
python3 -m pip install weasyprint   # ใช้ระบบ Python ที่มีอยู่ (มี weasyprint ให้ PDF ภาษาไทย)
npm start                            # รันที่ http://localhost:3000
```
ตอนเริ่มรันครั้งแรก backend จะสร้างตารางทั้งหมดใน Supabase ให้อัตโนมัติจาก `data/schema.postgres.sql` ไม่ต้อง run SQL เอง

### Frontend
```bash
cd frontend
npm install
npm start                            # dev server ที่ http://localhost:4200 (proxy ไป backend ที่ 3000)
```
ปรับ URL ของ backend ได้ที่ `src/environments/environment.ts` (dev) และ `environment.prod.ts` (production build)

## ฟีเจอร์หลัก

- จัดการลูกค้า / สินค้า-บริการ (CRUD พื้นฐาน)
- สร้างเอกสาร 3 ประเภท (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน) พร้อมเลขที่เอกสารอัตโนมัติ
- ดาวน์โหลด PDF ภาษาไทย (ฟอนต์ Sarabun) ต่อเอกสาร
- ส่งออกข้อมูลทั้งหมดเป็นไฟล์ Excel (.xlsx) ได้ทุกเมื่อ
- นำเข้าไฟล์ Excel เพื่ออัปเดตข้อมูลลูกค้า/สินค้าแบบ bulk (upsert ตาม id)

## ทำไมใช้ Postgres (Supabase) แทน Excel เป็นฐานข้อมูลจริง

Excel ไม่มี transaction/lock ในตัว ถ้าหลายคนเขียนพร้อมกันเสี่ยงไฟล์เสีย ส่วน Supabase เป็น PostgreSQL
ที่มี free tier ให้ 500MB จัดการ concurrent read/write ให้อัตโนมัติ ปลอดภัยกว่ามาก แถมข้อมูลอยู่แยกจาก
server ที่รัน backend เลย ไม่เสี่ยงหายตอน redeploy (ต่างจากไฟล์ SQLite ที่ต้องพึ่ง persistent disk ของ
hosting ซึ่งมักเสียเงินเพิ่ม) ไฟล์ Excel ในระบบนี้ทำหน้าที่เป็น "มุมมองข้อมูล" สำหรับ export/import เท่านั้น
ไม่ใช่ตัวเก็บข้อมูลหลัก

## Deploy ขึ้นเว็บจริง

โดเมนที่มีอยู่ที่ domains.squarespace.com เป็นแค่ตัวจดโดเมน ต้องหา hosting แยกสำหรับรันแอป แล้วมาตั้งค่า DNS ชี้มาที่ domain
ดูขั้นตอนละเอียดทั้งหมดได้ใน [`DEPLOYMENT.md`](DEPLOYMENT.md) สรุปคร่าว ๆ:

**Backend (Node + Supabase)** — ต้องการ hosting ที่รัน process ค้างไว้ตลอดเวลาได้ (ไม่ใช่ static hosting)
แนะนำ Render (รองรับ Dockerfile ตรง ๆ มี free tier ใช้ได้เพราะไม่ต้องพึ่ง persistent disk อีกต่อไป) ตั้งค่า:
1. เชื่อม repo → Root Directory = `backend` → Runtime = Docker
2. ตั้ง Environment Variable `DATABASE_URL` เป็น connection string จาก Supabase (ดู `backend/SUPABASE_SETUP.md`)
3. ตั้งค่า custom domain เป็น `api.yourdomain.com`

**Frontend (Angular static build)**
1. `cd frontend && npm run build` (ได้ไฟล์ static ใน `dist/frontend/browser`)
2. Deploy โฟลเดอร์นี้ไปที่ Vercel / Netlify / Cloudflare Pages (ฟรี)
3. ก่อน build ให้แก้ `src/environments/environment.prod.ts` ให้ `apiBaseUrl` ชี้ไปที่ backend จริง เช่น `https://api.yourdomain.com/api`
4. ตั้งค่า custom domain เป็น `app.yourdomain.com` หรือโดเมนหลักตามต้องการ

**DNS ที่ Squarespace** เพิ่ม CNAME/A record ตามที่ hosting แต่ละเจ้าแจ้ง เช่น
`api` → ชี้ไป Railway/Render, `app` หรือ `@` → ชี้ไป Vercel/Netlify

## หมายเหตุการพัฒนา (สำหรับ dev ที่ต่อยอด)

- `backend` ใช้ package `pg` เชื่อมต่อ Supabase (PostgreSQL) ผ่าน connection pooler (พอร์ต 6543)
  ตัวเลขที่เป็น `NUMERIC` ในฐานข้อมูล (เช่น ราคา จำนวน) ถูกตั้งค่าให้ parse กลับเป็น JS number อัตโนมัติ
  ใน `src/db.ts` (ปกติ `pg` จะคืนเป็น string เพื่อกัน precision loss)
- PDF generation เรียก python script ผ่าน `child_process` (เหตุผล: ใช้ weasyprint ที่ทดสอบแล้วว่า
  render ภาษาไทยได้ดี แทนการพึ่งพา headless-Chrome ฝั่ง Node ซึ่งโหลด binary หนักและ setup ยากกว่า)
- ยังไม่มีระบบ authentication — ก่อน deploy ใช้งานจริงควรเพิ่ม login (เช่น JWT หรือ Supabase Auth) เพื่อจำกัดสิทธิ์แก้ไขข้อมูล
- Import Excel รองรับเฉพาะ sheet Customers/Items (upsert ตาม id พร้อม sync sequence กันชนกับ id ที่สร้างใหม่)
  เอกสาร (Documents) ยังไม่รองรับ import เนื่องจากมีความสัมพันธ์ระหว่างตารางซับซ้อนกว่า ควรสร้างผ่านหน้าเว็บแทน
- ไฟล์ `data/schema.sql` (เวอร์ชัน SQLite เดิม) เหลือไว้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ได้ใช้งานแล้ว
  ตัวที่ backend ใช้จริงคือ `data/schema.postgres.sql`
