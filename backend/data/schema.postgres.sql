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
    logo_path       TEXT
);

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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
