import { Router } from "express";
import { one, run } from "../db";
import { getConfiguredPin, invalidatePinCache } from "./auth";

const router = Router();

/** ตัด access_pin ออกจาก response เสมอ (ไม่ควรส่งรหัสกลับไปให้ฝั่งหน้าบ้านเห็นค่าจริง)
 *  แทนที่ด้วย has_access_pin บอกแค่ว่าตั้งไว้หรือยัง ให้หน้าตั้งค่าโชว์สถานะได้ */
function sanitize(row: any) {
  if (!row) return row;
  const { access_pin, ...rest } = row;
  return { ...rest, has_access_pin: !!access_pin };
}

router.get("/", async (req, res) => {
  const r = await one<any>("SELECT * FROM company WHERE id = 1");
  res.json(sanitize(r));
});

router.put("/", async (req, res) => {
  const {
    name,
    address,
    tax_id,
    phone,
    email,
    logo_path,
    quotation_color,
    invoice_color,
    receipt_color,
    access_pin,
    current_pin,
  } = req.body;

  // เปลี่ยน/ตั้ง PIN: ถ้ามี PIN เดิมอยู่แล้ว ต้องยืนยันด้วย current_pin ที่ถูกต้องก่อนเสมอ
  // (ตั้งครั้งแรกที่ยังไม่เคยมี PIN เลย ไม่ต้องยืนยัน — ไม่มีอะไรให้ยืนยัน)
  if (access_pin !== undefined) {
    const existingPin = await getConfiguredPin();
    if (existingPin && (typeof current_pin !== "string" || current_pin !== existingPin)) {
      return res.status(400).json({ error: "รหัส PIN เดิมไม่ถูกต้อง" });
    }
  }

  await run(
    `UPDATE company SET
       name = COALESCE($1, name),
       address = COALESCE($2, address),
       tax_id = COALESCE($3, tax_id),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       logo_path = COALESCE($6, logo_path),
       quotation_color = COALESCE($7, quotation_color),
       invoice_color = COALESCE($8, invoice_color),
       receipt_color = COALESCE($9, receipt_color),
       access_pin = COALESCE($10, access_pin),
       access_pin_updated_at = CASE WHEN $10::text IS NOT NULL THEN NOW() ELSE access_pin_updated_at END
     WHERE id = 1`,
    [
      name ?? null,
      address ?? null,
      tax_id ?? null,
      phone ?? null,
      email ?? null,
      logo_path ?? null,
      quotation_color ?? null,
      invoice_color ?? null,
      receipt_color ?? null,
      // ส่งมาเป็นค่าว่าง "" ถือว่าตั้งใจล้าง PIN (ปิดการล็อก) ส่งมาเป็น undefined/ไม่ส่งมาเลย = ไม่แก้ไข
      access_pin !== undefined ? access_pin : null,
    ]
  );
  if (access_pin !== undefined) invalidatePinCache();
  const r = await one<any>("SELECT * FROM company WHERE id = 1");
  res.json(sanitize(r));
});

export default router;
