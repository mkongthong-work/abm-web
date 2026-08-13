# ABM Web — Angular + Node/SQLite + Excel Export/Import

เว็บแอประบบเอกสารธุรกิจ (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน) ต่อยอดจาก POC เดิม (`abm_poc/`)
สถาปัตยกรรม: Angular (frontend) → Node/Express REST API (backend) → SQLite (ฐานข้อมูลจริง ฟรี ไม่มีค่าใช้จ่าย)
พร้อมฟีเจอร์ Export/Import Excel (.xlsx) สำหรับให้ผู้ใช้ดาวน์โหลด/แก้ไขข้อมูลนอกระบบได้

## โครงสร้างโปรเจกต์

```
abm-web/
├── backend/            Node.js + TypeScript + Express + SQLite (node:sqlite)
│   ├── src/
│   ├── data/           schema.sql + abm.db (สร้างอัตโนมัติตอนรันครั้งแรก)
│   ├── pdf-service/     สคริปต์ python (weasyprint) สำหรับ render PDF ภาษาไทย
│   └── fonts/           ฟอนต์ Sarabun
└── frontend/            Angular 18 (standalone components)
    └── src/app/
        ├── pages/customers, items, documents, document-form
        ├── services/api.service.ts
        └── models/models.ts
```

## รันบนเครื่องตัวเอง (ครั้งแรก)

### Backend
```bash
cd backend
npm install
npm run build
python3 -m pip install weasyprint   # ใช้ระบบ Python ที่มีอยู่ (มี weasyprint ให้ PDF ภาษาไทย)
npm start                            # รันที่ http://localhost:3000
```
ต้องใช้ **Node.js 22+** (ใช้ `node:sqlite` ในตัว ไม่ต้องติดตั้ง native module เพิ่ม จึงไม่มีปัญหาเรื่อง compile บนเครื่องต่าง ๆ)

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

## ทำไมใช้ SQLite แทน Excel เป็นฐานข้อมูลจริง

Excel ไม่มี transaction/lock ในตัว ถ้าหลายคนเขียนพร้อมกันเสี่ยงไฟล์เสีย ส่วน SQLite เป็นไฟล์เดียวเหมือนกัน
**ไม่มีค่าใช้จ่าย** แต่จัดการ concurrent read/write ให้อัตโนมัติ ปลอดภัยกว่ามาก ไฟล์ Excel ในระบบนี้ทำหน้าที่เป็น
"มุมมองข้อมูล" สำหรับ export/import เท่านั้น ไม่ใช่ตัวเก็บข้อมูลหลัก

## Deploy ขึ้นเว็บจริง

โดเมนที่มีอยู่ที่ domains.squarespace.com เป็นแค่ตัวจดโดเมน ต้องหา hosting แยกสำหรับรันแอป แล้วมาตั้งค่า DNS ชี้มาที่ domain

**Backend (Node + SQLite)** — ต้องการ hosting ที่รัน process ค้างไว้ตลอดเวลาได้ (ไม่ใช่ static hosting)
แนะนำ Railway หรือ Render (มี free tier, รองรับ persistent disk เก็บไฟล์ `abm.db`) ตั้งค่า:
1. เชื่อม repo หรืออัปโหลดโค้ดโฟลเดอร์ `backend/`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. ต้องติดตั้ง Python + weasyprint บน server ด้วย (ใส่ `apt.txt`/`nixpacks.toml` หรือ Dockerfile ติดตั้ง `python3-pip` แล้ว `pip install weasyprint`)
5. ตั้งค่า persistent volume ให้ path `backend/data/` เพื่อไม่ให้ข้อมูลหายตอน redeploy
6. ตั้งค่า custom domain เป็น `api.yourdomain.com`

**Frontend (Angular static build)**
1. `cd frontend && npm run build` (ได้ไฟล์ static ใน `dist/frontend/browser`)
2. Deploy โฟลเดอร์นี้ไปที่ Vercel / Netlify / Cloudflare Pages (ฟรี)
3. ก่อน build ให้แก้ `src/environments/environment.prod.ts` ให้ `apiBaseUrl` ชี้ไปที่ backend จริง เช่น `https://api.yourdomain.com/api`
4. ตั้งค่า custom domain เป็น `app.yourdomain.com` หรือโดเมนหลักตามต้องการ

**DNS ที่ Squarespace** เพิ่ม CNAME/A record ตามที่ hosting แต่ละเจ้าแจ้ง เช่น
`api` → ชี้ไป Railway/Render, `app` หรือ `@` → ชี้ไป Vercel/Netlify

## หมายเหตุการพัฒนาในสภาพแวดล้อมนี้ (สำหรับ dev ที่ต่อยอด)

- `backend` ใช้ `node:sqlite` (built-in ตั้งแต่ Node 22) แทน `better-sqlite3` เพื่อเลี่ยงปัญหา native
  build บนเครื่อง/แพลตฟอร์มที่ไม่มี prebuilt binary
- PDF generation เรียก python script ผ่าน `child_process` (เหตุผล: ใช้ weasyprint ที่ทดสอบแล้วว่า
  render ภาษาไทยได้ดี แทนการพึ่งพา headless-Chrome ฝั่ง Node ซึ่งโหลด binary หนักและ setup ยากกว่า)
- ยังไม่มีระบบ authentication — ก่อน deploy ใช้งานจริงควรเพิ่ม login (เช่น JWT) เพื่อจำกัดสิทธิ์แก้ไขข้อมูล
- Import Excel รองรับเฉพาะ sheet Customers/Items (upsert) เอกสาร (Documents) ยังไม่รองรับ import
  เนื่องจากมีความสัมพันธ์ระหว่างตารางซับซ้อนกว่า ควรสร้างผ่านหน้าเว็บแทน
