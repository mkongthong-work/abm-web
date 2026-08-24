-- ABM (Accounting & Billing Management) — PostgreSQL / Supabase schema
-- Documents: quotation (ใบเสนอราคา), invoice (ใบแจ้งหนี้), receipt (ใบเสร็จรับเงิน)

-- ตั้งค่าบริษัทผู้ออกเอกสาร (แถวเดียว บังคับ id = 1)
CREATE TABLE IF NOT EXISTS company (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT NOT NULL,
    address         TEXT,
    tax_id          TEXT,
    phone           TEXT,
    email           TEXT,
    logo_path       TEXT,
    quotation_color TEXT NOT NULL DEFAULT '#0d9488',
    invoice_color   TEXT NOT NULL DEFAULT '#2563eb',
    receipt_color   TEXT NOT NULL DEFAULT '#7c3aed',
    access_pin      TEXT
);

-- migration กันไว้เผื่อฐานข้อมูลเดิมถูกสร้างก่อนมีคอลัมน์สี (ตาราง company มีอยู่แล้วจาก CREATE TABLE IF NOT EXISTS ด้านบน)
ALTER TABLE company ADD COLUMN IF NOT EXISTS quotation_color TEXT NOT NULL DEFAULT '#0d9488';
ALTER TABLE company ADD COLUMN IF NOT EXISTS invoice_color   TEXT NOT NULL DEFAULT '#2563eb';
ALTER TABLE company ADD COLUMN IF NOT EXISTS receipt_color   TEXT NOT NULL DEFAULT '#7c3aed';
-- รหัส PIN เข้าระบบ ตั้งได้จากหน้าตั้งค่าบริษัทในแอป (ไม่ต้องไปตั้งที่ ENV ของ Render ก็ได้ — ถ้าตั้งไว้ทั้งคู่ ค่านี้ในฐานข้อมูลมีสิทธิ์เหนือกว่า)
ALTER TABLE company ADD COLUMN IF NOT EXISTS access_pin TEXT;

-- ลูกค้า
CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    address         TEXT,
    tax_id          TEXT,
    phone           TEXT,
    email           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- รายการสินค้า/บริการ (แคตตาล็อกไว้เลือกใช้ซ้ำ)
CREATE TABLE IF NOT EXISTS items (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    unit            TEXT DEFAULT 'ชิ้น',
    unit_price      NUMERIC NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- เอกสาร (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน)
CREATE TABLE IF NOT EXISTS documents (
    id              SERIAL PRIMARY KEY,
    doc_type        TEXT NOT NULL CHECK (doc_type IN ('quotation', 'invoice', 'receipt')),
    doc_number      TEXT NOT NULL UNIQUE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    issue_date      TEXT NOT NULL,
    due_date        TEXT,
    ref_doc_id      INTEGER REFERENCES documents(id),
    vat_rate        NUMERIC NOT NULL DEFAULT 7.0,
    discount        NUMERIC NOT NULL DEFAULT 0,
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
    sign_left_label  TEXT NOT NULL DEFAULT 'ผู้ออกเอกสาร',
    sign_right_label TEXT NOT NULL DEFAULT 'ผู้รับเอกสาร',
    show_quantity   BOOLEAN NOT NULL DEFAULT TRUE,
    show_unit       BOOLEAN NOT NULL DEFAULT TRUE,
    show_price      BOOLEAN NOT NULL DEFAULT TRUE,
    combined_receipt BOOLEAN NOT NULL DEFAULT FALSE,
    theme           TEXT NOT NULL DEFAULT 'modern' CHECK (theme IN ('modern', 'minimal')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migration กันไว้เผื่อฐานข้อมูลเดิมถูกสร้างก่อนมีคอลัมน์ลงชื่อท้ายเอกสาร / คอลัมน์แสดงจำนวน-หน่วย
-- ตั้ง default เป็น TRUE เพื่อให้เอกสารเก่าที่มีอยู่แล้วยังแสดงคอลัมน์เหมือนเดิม (พฤติกรรมเดิมก่อนมี toggle)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_left_label  TEXT NOT NULL DEFAULT 'ผู้ออกเอกสาร';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sign_right_label TEXT NOT NULL DEFAULT 'ผู้รับเอกสาร';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS show_quantity BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS show_unit     BOOLEAN NOT NULL DEFAULT TRUE;
-- toggle: ซ่อนคอลัมน์ "ราคา/หน่วย" และ "จำนวนเงิน" พร้อมกันได้ (เช่น ใบส่งของที่ไม่ต้องการโชว์ราคา) ค่าเริ่มต้น: แสดง
ALTER TABLE documents ADD COLUMN IF NOT EXISTS show_price    BOOLEAN NOT NULL DEFAULT TRUE;
-- toggle: เอกสารประเภทใบแจ้งหนี้ (invoice) แสดงหัวเอกสารเป็น "ใบแจ้งหนี้ / ใบเสร็จรับเงิน" ได้ด้วย (ค่าเริ่มต้น: ปิด)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS combined_receipt BOOLEAN NOT NULL DEFAULT FALSE;
-- ธีมเอกสาร: 'modern' (มีสีตามประเภทเอกสาร ค่าเริ่มต้น) หรือ 'minimal' (ขาวดำ ไม่มีสี) เลือกได้ต่อเอกสาร
ALTER TABLE documents ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'modern' CHECK (theme IN ('modern', 'minimal'));

-- รายการสินค้าในเอกสารแต่ละใบ
CREATE TABLE IF NOT EXISTS document_items (
    id              SERIAL PRIMARY KEY,
    document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    item_id         INTEGER REFERENCES items(id),
    name            TEXT NOT NULL,
    description     TEXT,
    quantity        NUMERIC NOT NULL DEFAULT 1,
    unit            TEXT DEFAULT 'ชิ้น',
    unit_price      NUMERIC NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_document_items_document ON document_items(document_id);

-- ค่าเริ่มต้นของ "ตัวเลือกเอกสาร" ที่จำไว้ต่อบริษัท + ต่อประเภทเอกสาร (จำค่าที่ใช้ล่าสุด ไม่ใช่ค่าตั้งตายตัว)
-- ใช้ company_id เป็นส่วนหนึ่งของ PK ไว้ตั้งแต่ตอนนี้ เผื่ออนาคตรองรับ login ได้หลายบริษัท (ตอนนี้ยังใช้ company_id = 1 เสมอ)
-- เก็บเฉพาะ "ตัว toggle" ไม่เก็บค่าที่เป็นตัวเลข/ข้อความเฉพาะเอกสาร (ส่วนลด, ข้อความหมายเหตุ) เพราะแตกต่างกันไปทุกใบ
CREATE TABLE IF NOT EXISTS document_defaults (
    company_id        INTEGER NOT NULL REFERENCES company(id),
    doc_type          TEXT NOT NULL CHECK (doc_type IN ('quotation', 'invoice', 'receipt')),
    vat_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    vat_rate          NUMERIC NOT NULL DEFAULT 7.0,
    discount_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    note_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    combined_receipt  BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, doc_type)
);
