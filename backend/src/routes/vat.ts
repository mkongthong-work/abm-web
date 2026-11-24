import { Router } from "express";
import { many, one, run } from "../db";

const router = Router();
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// รายชื่อลูกค้าที่ต้องยื่น ภ.พ.30 ในเดือนที่เลือก + สถานะ/วันที่ยื่น
router.get("/dashboard", async (req, res) => {
  const month = String(req.query.month || "");
  if (!MONTH_RE.test(month)) return res.status(400).json({ error: "month ต้องเป็นรูปแบบ YYYY-MM" });
  const rows = await many(
    `SELECT c.id AS customer_id, c.name, c.tax_id,
            to_char(f.filed_at, 'YYYY-MM-DD') AS filed_at
     FROM customers c
     LEFT JOIN vat_filings f ON f.customer_id = c.id AND f.month = $1
     WHERE EXISTS (
       SELECT 1 FROM vat_filers p
       WHERE p.customer_id = c.id AND p.start_month <= $1 AND (p.end_month IS NULL OR p.end_month >= $1)
     )
     ORDER BY c.name`,
    [month]
  );
  res.json(rows);
});

// ติ๊ก/เอาติ๊กออก (ยื่นแล้ว) — filed_at ไม่ส่ง = วันนี้ (เวลาไทย)
router.put("/filings", async (req, res) => {
  const { customer_id, month, filed, filed_at } = req.body || {};
  if (!Number.isInteger(customer_id) || !MONTH_RE.test(month || "")) {
    return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" });
  }
  if (filed) {
    if (filed_at && !DATE_RE.test(filed_at)) return res.status(400).json({ error: "วันที่ไม่ถูกต้อง" });
    await run(
      `INSERT INTO vat_filings (customer_id, month, filed_at)
       VALUES ($1, $2, COALESCE($3::date, (NOW() AT TIME ZONE 'Asia/Bangkok')::date))
       ON CONFLICT (customer_id, month) DO UPDATE SET filed_at = EXCLUDED.filed_at`,
      [customer_id, month, filed_at ?? null]
    );
  } else {
    await run("DELETE FROM vat_filings WHERE customer_id = $1 AND month = $2", [customer_id, month]);
  }
  res.json({ ok: true });
});

// รายการช่วงที่ลูกค้าอยู่ในรายการ ภ.พ.30 (หน้าจัดการ)
router.get("/filers", async (req, res) => {
  const rows = await many(
    `SELECT p.id, p.customer_id, c.name, c.tax_id, p.start_month, p.end_month
     FROM vat_filers p JOIN customers c ON c.id = p.customer_id
     ORDER BY (p.end_month IS NOT NULL), c.name, p.start_month DESC`
  );
  res.json(rows);
});

router.post("/filers", async (req, res) => {
  const { customer_id, start_month } = req.body || {};
  if (!Number.isInteger(customer_id) || !MONTH_RE.test(start_month || "")) {
    return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" });
  }
  if (!(await one("SELECT 1 FROM customers WHERE id = $1", [customer_id]))) {
    return res.status(404).json({ error: "ไม่พบลูกค้า" });
  }
  if (await one("SELECT 1 FROM vat_filers WHERE customer_id = $1 AND end_month IS NULL", [customer_id])) {
    return res.status(409).json({ error: "ลูกค้ารายนี้อยู่ในรายการแล้ว" });
  }
  await run("INSERT INTO vat_filers (customer_id, start_month) VALUES ($1, $2)", [customer_id, start_month]);
  res.status(201).json({ ok: true });
});

// หยุดยื่น: end_month = เดือนสุดท้ายที่ยังต้องยื่น (เดือนหลังจากนั้นไม่แสดงใน Dashboard)
router.post("/filers/:id/stop", async (req, res) => {
  const { end_month } = req.body || {};
  if (!MONTH_RE.test(end_month || "")) return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง" });
  const r = await run(
    `UPDATE vat_filers SET end_month = GREATEST($1::text, start_month)
     WHERE id = $2 AND end_month IS NULL`,
    [end_month, req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: "ไม่พบรายการ" });
  res.json({ ok: true });
});

export default router;
