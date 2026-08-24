import { Router } from "express";
import multer from "multer";
import { many, one, run, withTransaction } from "../db";
import { sendBackupEmail } from "../mailer";
import { requireAuth } from "./auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const BACKUP_VERSION = 1;

// ---- รวมข้อมูลทุกตารางเป็น JSON เดียว (ใช้ทั้งดาวน์โหลดเองและส่งอีเมลอัตโนมัติ) ----
// หมายเหตุความปลอดภัย: ตั้งใจไม่ดึงคอลัมน์ company.access_pin เข้ามาในไฟล์สำรองเด็ดขาด
// เพราะไฟล์นี้อาจถูกส่งผ่านอีเมล การแนบรหัส PIN แบบข้อความล้วนไปด้วยถือเป็นความเสี่ยงด้านความปลอดภัย
async function buildBackupPayload() {
  const company = await one(
    `SELECT id, name, address, tax_id, phone, email, logo_path,
            quotation_color, invoice_color, receipt_color
     FROM company WHERE id = 1`
  );
  const customers = await many("SELECT * FROM customers ORDER BY id");
  const items = await many("SELECT * FROM items ORDER BY id");
  const documents = await many("SELECT * FROM documents ORDER BY id");
  const document_items = await many("SELECT * FROM document_items ORDER BY id");
  const document_defaults = await many("SELECT * FROM document_defaults ORDER BY company_id, doc_type");

  return {
    version: BACKUP_VERSION,
    generated_at: new Date().toISOString(),
    company,
    customers,
    items,
    documents,
    document_items,
    document_defaults,
  };
}

function backupFilename() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  return `abm-backup-${stamp}.json`;
}

// ------------------------------------------------------------- export ----
// ดาวน์โหลดข้อมูลสำรองแบบ manual จากหน้าตั้งค่า (ผ่าน requireAuth ตามปกติที่ mount ไว้ใน server.ts)
router.get("/export", requireAuth, async (req, res) => {
  const payload = await buildBackupPayload();
  await run("UPDATE company SET last_backup_at = NOW() WHERE id = 1");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${backupFilename()}"`);
  res.send(JSON.stringify(payload, null, 2));
});

// ------------------------------------------------------------- restore ----
// กู้คืนข้อมูลทั้งหมดจากไฟล์สำรอง — ล้างของเดิมแล้วเขียนใหม่ทั้งหมดแบบ all-or-nothing (transaction)
// ไม่แตะ company.access_pin เดิม กันไม่ให้การกู้คืนไปเปลี่ยน/ลบรหัส PIN เข้าระบบที่ตั้งไว้อยู่
router.post("/restore", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "กรุณาแนบไฟล์ข้อมูลสำรอง (.json)" });

  let payload: any;
  try {
    payload = JSON.parse(req.file.buffer.toString("utf-8"));
  } catch {
    return res.status(400).json({ error: "ไฟล์ไม่ใช่ JSON ที่ถูกต้อง" });
  }

  if (!payload || !Array.isArray(payload.customers) || !Array.isArray(payload.documents)) {
    return res.status(400).json({ error: "รูปแบบไฟล์ข้อมูลสำรองไม่ถูกต้อง" });
  }

  try {
    const summary = await withTransaction(async (client) => {
      // ลบข้อมูลเดิม (ลบตารางลูกก่อนตารางแม่)
      await client.query("DELETE FROM document_items");
      await client.query("DELETE FROM documents");
      await client.query("DELETE FROM document_defaults");
      await client.query("DELETE FROM items");
      await client.query("DELETE FROM customers");

      // เขียนข้อมูลใหม่ (ตารางแม่ก่อนตารางลูก)
      for (const c of payload.customers || []) {
        await client.query(
          `INSERT INTO customers (id, name, address, tax_id, phone, email, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))`,
          [c.id, c.name, c.address ?? null, c.tax_id ?? null, c.phone ?? null, c.email ?? null, c.created_at ?? null]
        );
      }
      for (const it of payload.items || []) {
        await client.query(
          `INSERT INTO items (id, name, description, unit, unit_price, created_at)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))`,
          [it.id, it.name, it.description ?? null, it.unit ?? "ชิ้น", it.unit_price ?? 0, it.created_at ?? null]
        );
      }
      for (const d of payload.documents || []) {
        await client.query(
          `INSERT INTO documents
             (id, doc_type, doc_number, customer_id, issue_date, due_date, ref_doc_id,
              vat_rate, discount, note, status, sign_left_label, sign_right_label,
              show_quantity, show_unit, combined_receipt, theme, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,COALESCE($18, NOW()))`,
          [
            d.id, d.doc_type, d.doc_number, d.customer_id, d.issue_date, d.due_date ?? null, d.ref_doc_id ?? null,
            d.vat_rate ?? 7, d.discount ?? 0, d.note ?? null, d.status ?? "draft",
            d.sign_left_label ?? "ผู้ออกเอกสาร", d.sign_right_label ?? "ผู้รับเอกสาร",
            d.show_quantity ?? true, d.show_unit ?? true, d.combined_receipt ?? false,
            d.theme ?? "modern", d.created_at ?? null,
          ]
        );
      }
      for (const di of payload.document_items || []) {
        await client.query(
          `INSERT INTO document_items
             (id, document_id, item_id, name, description, quantity, unit, unit_price, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [di.id, di.document_id, di.item_id ?? null, di.name, di.description ?? null, di.quantity ?? 1, di.unit ?? "ชิ้น", di.unit_price ?? 0, di.sort_order ?? 0]
        );
      }
      for (const dd of payload.document_defaults || []) {
        await client.query(
          `INSERT INTO document_defaults
             (company_id, doc_type, vat_enabled, vat_rate, discount_enabled, note_enabled, combined_receipt, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
          [
            dd.company_id ?? 1, dd.doc_type, dd.vat_enabled ?? false, dd.vat_rate ?? 7,
            dd.discount_enabled ?? false, dd.note_enabled ?? false, dd.combined_receipt ?? false, dd.updated_at ?? null,
          ]
        );
      }

      // ข้อมูลบริษัท: อัปเดตเฉพาะฟิลด์ ไม่แตะ access_pin เดิม
      if (payload.company) {
        const c = payload.company;
        await client.query(
          `UPDATE company SET
             name = $1, address = $2, tax_id = $3, phone = $4, email = $5, logo_path = $6,
             quotation_color = COALESCE($7, quotation_color),
             invoice_color = COALESCE($8, invoice_color),
             receipt_color = COALESCE($9, receipt_color)
           WHERE id = 1`,
          [c.name, c.address ?? null, c.tax_id ?? null, c.phone ?? null, c.email ?? null, c.logo_path ?? null,
            c.quotation_color ?? null, c.invoice_color ?? null, c.receipt_color ?? null]
        );
      }

      // sync sequence กันชนกับ id ที่กู้คืนกลับมาแบบระบุเอง
      await client.query("SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id) FROM customers), 1))");
      await client.query("SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 1))");
      await client.query("SELECT setval('documents_id_seq', COALESCE((SELECT MAX(id) FROM documents), 1))");
      await client.query("SELECT setval('document_items_id_seq', COALESCE((SELECT MAX(id) FROM document_items), 1))");

      return {
        customers: (payload.customers || []).length,
        items: (payload.items || []).length,
        documents: (payload.documents || []).length,
        document_items: (payload.document_items || []).length,
        document_defaults: (payload.document_defaults || []).length,
      };
    });

    res.json({ ok: true, restored: summary });
  } catch (err: any) {
    res.status(400).json({ error: `กู้คืนข้อมูลไม่สำเร็จ: ${err.message}` });
  }
});

// ------------------------------------------------------------- run (cron) ----
// สำหรับให้บริการ cron-ping ภายนอก (เช่น cron-job.org) เรียกเป็นระยะ — ไม่ผ่าน requireAuth
// (เพราะ cron ภายนอกแนบ token ระบบล็อกอินไม่ได้) แต่ตรวจ secret คนละตัวแทน
// ตั้ง secret ผ่าน ENV: BACKUP_TRIGGER_SECRET แล้วเรียก GET /api/backup/run?secret=...
router.get("/run", (req, res) => {
  const expected = process.env.BACKUP_TRIGGER_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า BACKUP_TRIGGER_SECRET บนเซิร์ฟเวอร์" });
  }
  if (req.query.secret !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // ตอบกลับ cron ภายนอกทันที ไม่รอขั้นส่งอีเมล — SMTP ขาออกบางทีช้า/ถูกหน่วงจนเกิน timeout ของ cron
  // (cron-job.org แผนฟรีตั้ง timeout เกิน 30 วิไม่ได้) งานจริงทำต่อ background แล้วดูผลจาก log บน Render แทน
  res.json({ ok: true, accepted_at: new Date().toISOString() });

  (async () => {
    try {
      const payload = await buildBackupPayload();
      const buffer = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
      await sendBackupEmail(buffer, backupFilename());
      await run("UPDATE company SET last_backup_at = NOW() WHERE id = 1");
      console.log("[backup] ส่งอีเมลข้อมูลสำรองสำเร็จ");
    } catch (err: any) {
      console.error("[backup] ส่งอีเมลข้อมูลสำรองไม่สำเร็จ:", err.message);
    }
  })();
});

export default router;
