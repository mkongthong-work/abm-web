import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
export const DB_PATH = process.env.ABM_DB_PATH || path.join(DATA_DIR, "abm.db");
const SCHEMA_PATH = path.join(DATA_DIR, "schema.sql");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

// เตรียมฐานข้อมูลเมื่อเริ่มระบบครั้งแรก
const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

const companyRow = db.prepare("SELECT id FROM company WHERE id = 1").get();
if (!companyRow) {
  db.prepare(
    `INSERT INTO company (id, name, address, tax_id, phone, email, logo_path)
     VALUES (1, ?, ?, ?, ?, ?, NULL)`
  ).run(
    "บริษัท ตัวอย่าง จำกัด (Sample Co., Ltd.)",
    "123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10110",
    "0000000000000",
    "02-000-0000",
    "info@example.com"
  );
  console.log("[db] สร้างฐานข้อมูลใหม่พร้อมข้อมูลบริษัทตัวอย่าง (placeholder)");
}

// helper: แปลง row ให้เป็น plain object เสมอ (node:sqlite คืน null-prototype object)
export function row<T = any>(r: any): T | null {
  return r ? ({ ...r } as T) : null;
}
export function rows<T = any>(list: any[]): T[] {
  return list.map((r) => ({ ...r }));
}
