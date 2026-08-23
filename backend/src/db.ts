import { Pool, PoolClient, QueryResultRow, types } from "pg";

// NUMERIC ของ Postgres ปกติจะถูกส่งกลับเป็น string (กัน precision loss)
// แต่แอปนี้ใช้เป็นตัวเลขเงิน/จำนวนตรง ๆ จึงแปลงเป็น float ให้เลยตั้งแต่ตอนอ่าน
types.setTypeParser(1700, (val: string) => parseFloat(val));
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
const SCHEMA_PATH = path.join(DATA_DIR, "schema.postgres.sql");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "ไม่พบ DATABASE_URL — ตั้งค่า environment variable นี้เป็น connection string ของ Supabase " +
      "(ดูวิธีได้ใน SUPABASE_SETUP.md)"
  );
}

// Supabase ต้องเชื่อมต่อผ่าน SSL เสมอ
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ---- helper functions (แทนที่ better-sqlite3 / node:sqlite API เดิม) ----
export async function one<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const { rows } = await pool.query<T>(sql, params);
  return rows[0] ?? null;
}

export async function many<T extends QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

export async function run(sql: string, params: any[] = []) {
  return pool.query(sql, params);
}

// ---- transaction helper (ใช้ตอนกู้คืนข้อมูลสำรอง ที่ต้องลบ+เขียนหลายตารางแบบ all-or-nothing) ----
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---- เตรียมฐานข้อมูล (เรียกครั้งเดียวตอนเริ่ม server) ----
export async function initDb(): Promise<void> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  await pool.query(schema);

  const company = await one("SELECT id FROM company WHERE id = 1");
  if (!company) {
    await run(
      `INSERT INTO company (id, name, address, tax_id, phone, email, logo_path)
       VALUES (1, $1, $2, $3, $4, $5, NULL)`,
      [
        "บริษัท ตัวอย่าง จำกัด (Sample Co., Ltd.)",
        "123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10110",
        "0000000000000",
        "02-000-0000",
        "info@example.com",
      ]
    );
    console.log("[db] สร้างฐานข้อมูลใหม่พร้อมข้อมูลบริษัทตัวอย่าง (placeholder)");
  }
}
