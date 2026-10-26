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

สิ่งที่ต้องมีก่อน: Node.js 18+ (แนะนำ 22 ให้ตรงกับที่ deploy จริงบน Render), Python 3, และ Supabase
project (ฟรี) สำหรับฐานข้อมูล

### 1) Backend

ต้องมี Supabase project และ connection string ก่อน — ดูวิธีสร้างละเอียดใน [`backend/SUPABASE_SETUP.md`](backend/SUPABASE_SETUP.md)

```bash
cd backend
cp .env.example .env        # แล้วใส่ DATABASE_URL จาก Supabase (ค่าอื่นในไฟล์นี้ไม่ต้องตั้งตอน dev ในเครื่อง — ดูหมายเหตุด้านล่าง)
npm install
npm run build
npm start                    # รันที่ http://localhost:3000
```

ตอนเริ่มรันครั้งแรก backend จะสร้างตารางทั้งหมดใน Supabase ให้อัตโนมัติจาก `data/schema.postgres.sql`
ไม่ต้อง run SQL เอง (ระหว่างพัฒนาต่อ ใช้ `npm run dev` แทน `build`+`start` ได้ — auto-restart ทุกครั้งที่แก้โค้ด)

**ติดตั้ง WeasyPrint (สำหรับ render PDF ภาษาไทย)** — แนะนำสร้าง virtualenv แยกไว้ที่ `backend/pdf-service/venv`
เพราะโค้ด (`src/pdf.ts`) หา python จากที่นี่ให้อัตโนมัติ (กัน error "externally-managed-environment" ที่เจอบ่อย
บน macOS/Homebrew Python ถ้า pip install ตรง ๆ เข้า Python ระบบ):

```bash
cd backend/pdf-service
python3 -m venv venv
source venv/bin/activate      # Windows (PowerShell): venv\Scripts\Activate.ps1
pip install weasyprint
deactivate
```

ไม่ต้องตั้งค่า PIN (`ABM_ACCESS_PIN`) ตอน dev ในเครื่อง — ถ้าไม่ตั้งไว้เลยทั้งใน `.env` และในหน้าตั้งค่าของแอป
ระบบจะไม่บังคับล็อกอินใด ๆ เข้าใช้งานได้ทันที (ค่านี้จำเป็นเฉพาะตอน deploy ขึ้นจริงเท่านั้น)

### 2) Frontend

```bash
cd frontend
npm install
npm start                    # dev server ที่ http://localhost:4200 เรียก backend ที่ localhost:3000 โดยตรง (ผ่าน CORS ไม่ใช่ proxy)
```

ปรับ URL ของ backend ได้ที่ `src/environments/environment.ts` (dev) และ `environment.prod.ts` (production build)
— ค่า dev ตั้งเป็น `http://localhost:3000/api` ไว้แล้ว ไม่ต้องแก้ถ้ารัน backend ที่พอร์ตเดิม

เปิด `http://localhost:4200` แล้วใช้งานได้เลย (frontend + backend ต้องรันพร้อมกันคนละ terminal)

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
- ระบบล็อกอินเป็น PIN เดียวที่ทุกคนในบริษัทใช้ร่วมกัน (ไม่ใช่ระบบผู้ใช้แยกรายบุคคล) ตั้งได้จากหน้าตั้งค่าบริษัทในแอป
  หรือ ENV `ABM_ACCESS_PIN` — ถ้าไม่ตั้งไว้เลยทั้งคู่ แอปจะไม่บังคับล็อกอิน (ดูรายละเอียดใน `src/routes/auth.ts`)
- ข้อมูลสำรองทั้งระบบส่งเป็นอีเมลอัตโนมัติผ่าน Brevo API (HTTPS) ไม่ใช่ SMTP ตรง ๆ เพราะ hosting ฟรีหลายเจ้า
  (รวมถึง Render) บล็อกพอร์ต SMTP ขาออกทั้งหมด — ต้องตั้ง `BREVO_API_KEY` และ verify อีเมลผู้ส่ง (`SMTP_USER`)
  ไว้ในบัญชี Brevo ก่อน ดูรายละเอียดใน `.env.example`
- endpoint `/api/ping` ไว้ให้ cron ภายนอกยิงถี่ ๆ (เช่นทุก 10 นาที) กันทั้ง Render free tier หลับ และกัน
  Supabase free tier project pause จากการไม่มีการใช้ฐานข้อมูลเกิน 7 วัน
- Import Excel รองรับเฉพาะ sheet Customers/Items (upsert ตาม id พร้อม sync sequence กันชนกับ id ที่สร้างใหม่)
  เอกสาร (Documents) ยังไม่รองรับ import เนื่องจากมีความสัมพันธ์ระหว่างตารางซับซ้อนกว่า ควรสร้างผ่านหน้าเว็บแทน
- ไฟล์ `data/schema.sql` (เวอร์ชัน SQLite เดิม) เหลือไว้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ได้ใช้งานแล้ว
  ตัวที่ backend ใช้จริงคือ `data/schema.postgres.sql`
