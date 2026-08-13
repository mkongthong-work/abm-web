# วิธี Deploy ABM Web แบบละเอียด

โครงสร้าง: GitHub repo เดียว (monorepo) → deploy แยก 2 service คือ backend (Render) และ frontend (Vercel)
แล้วชี้ domain จาก Squarespace มาที่ทั้งสอง service

---

## ขั้นตอนที่ 1 — เตรียมโค้ดขึ้น GitHub

1. เปิด terminal ที่โฟลเดอร์ `abm-web/` แล้วรัน:
   ```bash
   git init
   git add .
   git commit -m "initial commit: ABM web app"
   ```
2. สร้าง repo ใหม่บน GitHub (เช่น `abm-web`) แบบ private หรือ public ก็ได้
3. เชื่อมและ push:
   ```bash
   git remote add origin https://github.com/<username>/abm-web.git
   git branch -M main
   git push -u origin main
   ```

ไฟล์ `.gitignore` เตรียมไว้ให้แล้ว (กัน `node_modules/`, `dist/`, ไฟล์ฐานข้อมูล `abm.db` ไม่ให้หลุดขึ้น git)

---

## ขั้นตอนที่ 2 — Deploy Backend (Render)

Render รองรับ Dockerfile ตรง ๆ ตอนนี้ backend เก็บข้อมูลบน **Supabase (PostgreSQL)** ไม่ใช่ไฟล์ในเครื่องแล้ว
จึงใช้ **แผนฟรีของ Render ได้เต็มที่** โดยไม่เสี่ยงข้อมูลหาย (ไม่ต้องเปิด Persistent Disk ที่ต้องเสียเงินเพิ่มอีกต่อไป)

ก่อนเริ่มขั้นตอนนี้ ต้องมี Supabase project และ connection string พร้อมแล้ว — ถ้ายังไม่มีให้ทำตาม
[`backend/SUPABASE_SETUP.md`](backend/SUPABASE_SETUP.md) ก่อน

### 2.1 สร้าง Web Service

1. เข้า https://dashboard.render.com → สมัคร/Login ด้วย GitHub
2. กด **New +** (มุมขวาบน) → เลือก **Web Service**
3. เลือก **Build and deploy from a Git repository** → กด Connect ที่ repo `abm-web` (ถ้ายังไม่เห็น repo ให้กด "Configure account" เพื่อให้สิทธิ์ Render เข้าถึง repo นั้นก่อน)
4. หน้าตั้งค่า service กรอกดังนี้:
   - **Name**: `abm-backend` (หรือชื่อที่ต้องการ จะกลายเป็นส่วนหนึ่งของ URL เริ่มต้น)
   - **Region**: เลือกที่ใกล้ผู้ใช้งานที่สุด (เช่น Singapore ถ้ามี — ลด latency)
   - **Branch**: `main`
   - **Root Directory**: `backend` (**สำคัญมาก** ไม่งั้น Render จะพยายาม build จาก root ของ repo ทั้งหมด)
   - **Runtime**: เลือก **Docker** (Render จะเจอ `backend/Dockerfile` ให้อัตโนมัติเมื่อ Root Directory ตั้งถูก)
   - **Instance Type**: เลือก **Free** ได้เลย (ไม่ต้อง Disk แล้ว) หรือจ่าย Starter ถ้าอยากเลี่ยงอาการ sleep

### 2.2 ตั้งค่า Environment Variables

ที่แท็บ **Environment** ของ service เพิ่ม:
- `DATABASE_URL` = connection string จาก Supabase (รูปแบบ `postgresql://postgres.xxxx:PASSWORD@aws-0-xxxx.pooler.supabase.com:6543/postgres`)

ไม่ต้องตั้งค่า `PORT` เอง Render จะกำหนดให้อัตโนมัติผ่าน environment variable `PORT` ซึ่งโค้ด backend อ่านค่านี้อยู่แล้ว (`process.env.PORT`)

> **แผนฟรี Render จะ "sleep" เมื่อไม่มีคนเรียกใช้ ~15 นาที** เรียกครั้งถัดไปจะช้าประมาณ 30-60 วินาทีตอน wake ขึ้นมา — เป็นคนละเรื่องกับข้อมูลหาย (ข้อมูลปลอดภัยเพราะอยู่ที่ Supabase) ถ้าอยากเลี่ยงความช้าตรงนี้ค่อยพิจารณาอัปเป็น Starter plan ทีหลังได้

### 2.3 Deploy และทดสอบ

1. กด **Create Web Service** — Render จะเริ่ม build ทันที (ครั้งแรกใช้เวลา 3-6 นาที เพราะต้อง build Docker image ที่มีทั้ง Node + Python + WeasyPrint)
2. ดู log การ build ได้ที่แท็บ **Logs** ถ้า build fail ให้เช็ค log ตรงนั้นก่อน (ส่วนใหญ่มักเป็นเรื่อง Root Directory ตั้งผิด หรือ `DATABASE_URL` ผิด/ยังไม่ได้ตั้ง)
3. เมื่อ build เสร็จ Render จะให้ URL มาเช่น `https://abm-backend.onrender.com`
4. ทดสอบ: เปิด `https://abm-backend.onrender.com/api/health` ควรเห็น `{"ok":true}` และ `https://abm-backend.onrender.com/api/company` ควรเห็นข้อมูลบริษัทตัวอย่าง (พิสูจน์ว่าเชื่อม Supabase สำเร็จและสร้างตารางอัตโนมัติแล้ว)
5. ตั้งค่า custom domain: ไปที่ service → **Settings → Custom Domain** → Add Custom Domain → ใส่ `api.yourdomain.com`
   Render จะให้ค่า CNAME มา (ปกติเป็นชื่อ service เดิม เช่น `abm-backend.onrender.com`) เก็บไว้ใช้ในขั้นตอนที่ 4

### 2.4 Auto-deploy เมื่อ push โค้ดใหม่

ค่าเริ่มต้น Render จะ deploy อัตโนมัติทุกครั้งที่ push เข้า branch `main` ปิดได้ที่ **Settings → Auto-Deploy** ถ้าต้องการควบคุมเองว่าจะ deploy เมื่อไหร่

---

## ขั้นตอนที่ 3 — Deploy Frontend (Vercel)

1. เข้า https://vercel.com → Login ด้วย GitHub
2. กด **Add New → Project** → เลือก repo `abm-web`
3. ตั้งค่า:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vercel มักจะเดา "Angular" ให้อัตโนมัติ ถ้าไม่ ให้ตั้งเอง
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/frontend/browser` (สำคัญ — Angular 18 ใหม่จะสร้างซับโฟลเดอร์ `browser` เพิ่มมา ถ้าใส่ผิดจะได้หน้าเปล่า)
4. **ก่อนกด Deploy** ต้องแก้ไฟล์ `frontend/src/environments/environment.prod.ts` ให้ `apiBaseUrl` ชี้ไปที่ backend จริงจากขั้นตอนที่ 2 เช่น:
   ```ts
   export const environment = {
     production: true,
     apiBaseUrl: 'https://api.yourdomain.com/api',
   };
   ```
   แก้แล้ว commit + push ขึ้น GitHub ก่อน Vercel จะ build จากโค้ดล่าสุดเสมอ
5. กด Deploy รอ 1-2 นาที
6. ทดสอบ: เปิด URL ที่ Vercel ให้มา (เช่น `https://abm-web.vercel.app`) ควรเห็นหน้าเว็บ และถ้าเปิด DevTools → Network ไม่ควรมี error CORS
7. ตั้งค่า custom domain: ไปที่ Project → **Settings → Domains** → ใส่ `app.yourdomain.com` (หรือโดเมนหลัก `yourdomain.com` ก็ได้)
   Vercel จะให้ค่า A record หรือ CNAME มา เก็บไว้ใช้ในขั้นตอนถัดไป

---

## ขั้นตอนที่ 4 — ตั้งค่า DNS ที่ Squarespace

1. เข้า https://domains.squarespace.com → เลือกโดเมน → **DNS Settings**
2. เพิ่ม record ตามที่ Render/Vercel ให้มาในขั้นตอนก่อนหน้า โดยทั่วไปจะเป็น:

   | Host | Type  | Value (ตัวอย่าง — ใช้ค่าจริงจาก Render/Vercel) |
   |------|-------|--------------------------------------------------|
   | api  | CNAME | `abm-backend.onrender.com`                        |
   | app  | CNAME | `cname.vercel-dns.com`                            |

   (หรือถ้าจะใช้โดเมนหลัก `yourdomain.com` ตรง ๆ กับ Vercel มักต้องใช้ A record ชี้ไป IP ที่ Vercel กำหนด — ดูค่าที่ถูกต้องจากหน้า Domains ของ Vercel ตอนเพิ่ม custom domain)

3. รอ DNS propagate (ปกติ 10 นาที - 1 ชั่วโมง บางทีถึง 24 ชม.)
4. ทดสอบด้วย `https://app.yourdomain.com` ควรเปิดเว็บได้ และเรียก API ที่ `https://api.yourdomain.com` ได้ปกติ

---

## Checklist ตรวจสอบหลัง deploy

- [ ] `https://api.yourdomain.com/api/health` ตอบ `{"ok":true}`
- [ ] เข้าเว็บที่ `https://app.yourdomain.com` แล้วหน้า "เอกสาร" โหลดขึ้น (ไม่ error CORS ใน console)
- [ ] เพิ่มลูกค้าทดสอบ 1 ราย แล้ว redeploy backend ใหม่ 1 ครั้ง (กด Manual Deploy บน Render) แล้วเช็คว่าลูกค้าที่เพิ่มไว้ยังอยู่ (พิสูจน์ว่าข้อมูลอยู่ที่ Supabase จริง ไม่ผูกกับ container ของ Render)
- [ ] สร้างเอกสารทดสอบ แล้วกดดาวน์โหลด PDF ได้ ตัวอักษรไทยไม่เพี้ยน
- [ ] กด "ส่งออก Excel" ได้ไฟล์ .xlsx ที่เปิดได้ปกติ
- [ ] ถ้าใช้แผนฟรี: ปล่อยเว็บทิ้งไว้ไม่มีคนเรียก ~20 นาที แล้วลองเปิดใหม่ ควรเห็นว่าโหลดช้ากว่าปกติ (เพราะ sleep) แต่สุดท้ายใช้งานได้ปกติ — เป็นพฤติกรรมที่คาดหวังได้ ไม่ใช่ bug
- [ ] ถ้า Supabase project ไม่ได้ใช้งานเกิน 7 วันแล้ว backend ต่อฐานข้อมูลไม่ติด ให้เข้า Supabase Dashboard กด resume โปรเจกต์ก่อน

## ข้อควรระวังก่อนเปิดให้คนอื่นใช้จริง

ระบบยังไม่มี authentication ใครก็เข้าถึง URL แล้วแก้ไข/ลบข้อมูลได้ทั้งหมด ถ้าจะเปิดใช้งานจริงกับทีมหรือลูกค้า
ควรเพิ่มระบบ login (เช่น JWT + username/password) ก่อน — แจ้งได้ถ้าต้องการให้ช่วยทำส่วนนี้ต่อ
