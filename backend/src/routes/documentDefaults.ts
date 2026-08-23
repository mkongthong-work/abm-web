import { Router } from "express";
import { one, run } from "../db";

const router = Router();

const VALID_TYPES = ["quotation", "invoice", "receipt"];

// ยังใช้บริษัทเดียว (id = 1) เสมอ — company_id แยกไว้เป็นส่วนหนึ่งของ PK ตั้งแต่ตอนนี้เผื่ออนาคตรองรับหลายบริษัท
const COMPANY_ID = 1;

const FALLBACK = {
  vat_enabled: false,
  vat_rate: 7,
  discount_enabled: false,
  note_enabled: false,
  combined_receipt: false,
};

// ค่าเริ่มต้น (จำค่าที่ใช้ล่าสุด) ของ "ตัวเลือกเอกสาร" ต่อประเภทเอกสาร
router.get("/:type", async (req, res) => {
  const type = req.params.type;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });

  const row = await one<any>(
    "SELECT vat_enabled, vat_rate, discount_enabled, note_enabled, combined_receipt FROM document_defaults WHERE company_id = $1 AND doc_type = $2",
    [COMPANY_ID, type]
  );
  res.json(row || FALLBACK);
});

// บันทึกค่าที่ใช้ล่าสุด (เรียกอัตโนมัติทุกครั้งที่สร้างเอกสารใหม่สำเร็จ)
router.put("/:type", async (req, res) => {
  const type = req.params.type;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });

  const { vat_enabled, vat_rate, discount_enabled, note_enabled, combined_receipt } = req.body;

  await run(
    `INSERT INTO document_defaults (company_id, doc_type, vat_enabled, vat_rate, discount_enabled, note_enabled, combined_receipt, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (company_id, doc_type) DO UPDATE SET
       vat_enabled = EXCLUDED.vat_enabled,
       vat_rate = EXCLUDED.vat_rate,
       discount_enabled = EXCLUDED.discount_enabled,
       note_enabled = EXCLUDED.note_enabled,
       combined_receipt = EXCLUDED.combined_receipt,
       updated_at = NOW()`,
    [
      COMPANY_ID,
      type,
      !!vat_enabled,
      Number(vat_rate) || 0,
      !!discount_enabled,
      !!note_enabled,
      !!combined_receipt,
    ]
  );
  res.json({ ok: true });
});

export default router;
