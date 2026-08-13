# วิธีเชื่อมต่อ Supabase (PostgreSQL) กับ backend

backend เปลี่ยนจาก SQLite ไฟล์เดียวมาใช้ PostgreSQL ผ่าน Supabase แล้ว วิธีตั้งค่า:

## 1. สร้างโปรเจกต์ Supabase

1. เข้า https://supabase.com → สมัคร/Login → กด **New Project**
2. ตั้งชื่อโปรเจกต์ (เช่น `abm-web`) เลือก Region ที่ใกล้ผู้ใช้ที่สุด (เช่น Singapore)
3. ตั้ง **Database Password** — เก็บรหัสนี้ไว้ให้ดี จะใช้ในขั้นตอนถัดไป (Supabase จะไม่โชว์อีกครั้ง)
4. รอสร้างโปรเจกต์เสร็จ (~2 นาที)

## 2. คัดลอก Connection String

1. ในโปรเจกต์ Supabase ไปที่ **Project Settings** (ไอคอนเฟือง) → **Database**
2. เลื่อนไปหา **Connection string** เลือกแท็บ **URI**
3. แนะนำให้ใช้โหมด **Transaction pooler** (พอร์ต 6543) แทน Direct connection (พอร์ต 5432) — เพราะ backend เป็น serverless-ish ที่เปิด/ปิด connection บ่อย pooler จะจัดการ connection ให้มีประสิทธิภาพกว่า และ Render/Railway บาง network ก็เข้าถึง direct connection ไม่ได้
4. จะได้ string หน้าตาประมาณนี้:
   ```
   postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
5. แทนที่ `[YOUR-PASSWORD]` ด้วยรหัสผ่านที่ตั้งไว้ในขั้นตอนที่ 1

## 3. ตั้งค่าใช้งานบนเครื่อง (local development)

```bash
cd backend
cp .env.example .env
```
เปิดไฟล์ `.env` แล้ววาง connection string ที่ `DATABASE_URL=`

```bash
npm install
npm run build
npm start
```
ตอนเริ่มรันครั้งแรก โค้ดจะสร้างตารางทั้งหมดให้อัตโนมัติจาก `data/schema.postgres.sql` (เหมือน `CREATE TABLE IF NOT EXISTS`) ไม่ต้อง run SQL เองที่ Supabase Dashboard

ทดสอบว่าเชื่อมต่อสำเร็จ:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/company
```
ถ้าเห็นข้อมูลบริษัทตัวอย่าง (placeholder) กลับมา แปลว่าเชื่อมต่อ Supabase สำเร็จและสร้างตารางเรียบร้อยแล้ว

## 4. ตั้งค่าตอน deploy บน Render

1. ไปที่ service บน Render → แท็บ **Environment**
2. เพิ่ม Environment Variable: `DATABASE_URL` = connection string เดียวกับข้อ 2 (ใช้ค่าเดียวกับที่ใช้ในเครื่อง หรือจะสร้าง Supabase project แยกสำหรับ production ก็ได้ถ้าอยากแยก data dev/prod)
3. **ไม่ต้องเปิด Persistent Disk บน Render อีกต่อไป** เพราะข้อมูลอยู่ที่ Supabase ไม่ใช่ในดิสก์ของ Render แล้ว — ใช้แผนฟรีของ Render ได้เต็มที่โดยไม่เสี่ยงข้อมูลหาย (ยกเว้นเรื่อง sleep ตอนไม่มีคนใช้ ซึ่งเป็นคนละประเด็นกับข้อมูลหาย)
4. Deploy ใหม่ 1 ครั้งให้ env var มีผล

## หมายเหตุ

- Supabase free tier โปรเจกต์จะ **pause อัตโนมัติหลังไม่มีการใช้งาน 7 วัน** ถ้าเข้าเว็บแล้ว backend ต่อฐานข้อมูลไม่ติด ให้เข้าไปที่ Supabase Dashboard เพื่อกด resume โปรเจกต์ก่อน
- ดู/แก้ข้อมูลตรง ๆ ได้ที่ Supabase Dashboard → **Table Editor** โดยไม่ต้องผ่านแอปเลยก็ได้ (สะดวกเวลา debug)
- ถ้าต้องการ migrate ข้อมูลเก่าจาก SQLite (`abm.db`) มาลง Supabase สามารถ export เป็น Excel จากแอปเวอร์ชันเก่าก่อน แล้วใช้ปุ่ม "นำเข้า Excel" ในเว็บเวอร์ชันใหม่เพื่อนำเข้าลูกค้า/สินค้ากลับเข้าไป (เอกสารต้องสร้างใหม่ผ่านหน้าเว็บ เพราะฟีเจอร์นำเข้ายังไม่รองรับ documents)
