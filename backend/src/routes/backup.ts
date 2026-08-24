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

// ---- แทนที่ทั้งหมด: ล้างของเดิมแล้วเขียนใหม่ทั้งหมดแบบ all-or-nothing (transaction) ----
// ไม่แตะ company.access_pin เดิม กันไม่ให้การกู้คืนไปเปลี่ยน/ลบรหัส PIN เข้าระบบที่ตั้งไว้อยู่
async function restoreReplace(payload: any) {
  return withTransaction(async (client) => {
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
            show_quantity, show_unit, show_price, void_reason, combined_receipt, theme, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,COALESCE($20, NOW()))`,
        [
          d.id, d.doc_type, d.doc_number, d.customer_id, d.issue_date, d.due_date ?? null, d.ref_doc_id ?? null,
          d.vat_rate ?? 7, d.discount ?? 0, d.note ?? null, d.status ?? "draft",
          d.sign_left_label ?? "ผู้ออกเอกสาร", d.sign_right_label ?? "ผู้รับเอกสาร",
          d.show_quantity ?? true, d.show_unit ?? true, d.show_price ?? true, d.void_reason ?? null,
          d.combined_receipt ?? false, d.theme ?? "modern", d.created_at ?? null,
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
      customers: { added: (payload.customers || []).length, skipped: 0 },
      items: { added: (payload.items || []).length, skipped: 0 },
      documents: { added: (payload.documents || []).length, skipped: 0 },
      document_items: { added: (payload.document_items || []).length, skipped: 0 },
      document_defaults: { added: (payload.document_defaults || []).length, skipped: 0 },
    };
  });
}

// ---- ผสานกับข้อมูลเดิม: ไม่ลบอะไรเลย เพิ่มเฉพาะรายการที่ยังไม่มีในระบบ (เทียบด้วย id เดิม) ----
// เอกสารเช็คซ้ำด้วย doc_number เพิ่มอีกชั้น เพราะ doc_number มี UNIQUE constraint ในฐานข้อมูล
// (id ต่างกันแต่ doc_number ซ้ำจะ insert ไม่ผ่านอยู่ดี ถ้าไม่กันไว้ก่อนทั้ง transaction จะ rollback หมด)
// ไม่แตะข้อมูลบริษัท (ชื่อ/ที่อยู่/สี ฯลฯ) เลย เพราะเป็นค่าตั้งเดี่ยวของระบบ ไม่ใช่รายการที่ "ผสาน" กันได้ตามธรรมชาติ
async function restoreMerge(payload: any) {
  return withTransaction(async (client) => {
    const exists = async (sql: string, params: any[]) => {
      const r = await client.query(sql, params);
      return (r.rowCount ?? 0) > 0;
    };

    let customersAdded = 0, customersSkipped = 0;
    for (const c of payload.customers || []) {
      if (await exists("SELECT 1 FROM customers WHERE id = $1", [c.id])) { customersSkipped++; continue; }
      await client.query(
        `INSERT INTO customers (id, name, address, tax_id, phone, email, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))`,
        [c.id, c.name, c.address ?? null, c.tax_id ?? null, c.phone ?? null, c.email ?? null, c.created_at ?? null]
      );
      customersAdded++;
    }

    let itemsAdded = 0, itemsSkipped = 0;
    for (const it of payload.items || []) {
      if (await exists("SELECT 1 FROM items WHERE id = $1", [it.id])) { itemsSkipped++; continue; }
      await client.query(
        `INSERT INTO items (id, name, description, unit, unit_price, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))`,
        [it.id, it.name, it.description ?? null, it.unit ?? "ชิ้น", it.unit_price ?? 0, it.created_at ?? null]
      );
      itemsAdded++;
    }

    // เก็บ id เอกสารที่เพิ่มจริง (ไม่ถูกข้าม) ไว้กรองว่ารายการสินค้าของเอกสารไหนควรเพิ่มตามไปด้วย
    const mergedDocIds = new Set<number>();
    let documentsAdded = 0, documentsSkipped = 0;
    for (const d of payload.documents || []) {
      if (await exists("SELECT 1 FROM documents WHERE id = $1 OR doc_number = $2", [d.id, d.doc_number])) {
        documentsSkipped++;
        continue;
      }
      await client.query(
        `INSERT INTO documents
           (id, doc_type, doc_number, customer_id, issue_date, due_date, ref_doc_id,
            vat_rate, discount, note, status, sign_left_label, sign_right_label,
            show_quantity, show_unit, show_price, void_reason, combined_receipt, theme, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,COALESCE($20, NOW()))`,
        [
          d.id, d.doc_type, d.doc_number, d.customer_id, d.issue_date, d.due_date ?? null, d.ref_doc_id ?? null,
          d.vat_rate ?? 7, d.discount ?? 0, d.note ?? null, d.status ?? "draft",
          d.sign_left_label ?? "ผู้ออกเอกสาร", d.sign_right_label ?? "ผู้รับเอกสาร",
          d.show_quantity ?? true, d.show_unit ?? true, d.show_price ?? true, d.void_reason ?? null,
          d.combined_receipt ?? false, d.theme ?? "modern", d.created_at ?? null,
        ]
      );
      mergedDocIds.add(d.id);
      documentsAdded++;
    }

    let documentItemsAdded = 0, documentItemsSkipped = 0;
    for (const di of payload.document_items || []) {
      // เอกสารแม่ของรายการนี้ถูกข้ามไป (มีอยู่แล้ว) — ไม่ต้องเพิ่มรายการสินค้าตามไปด้วย เอกสารเดิมมีของมันเองอยู่แล้ว
      if (!mergedDocIds.has(di.document_id)) { documentItemsSkipped++; continue; }
      if (await exists("SELECT 1 FROM document_items WHERE id = $1", [di.id])) { documentItemsSkipped++; continue; }
      await client.query(
        `INSERT INTO document_items
           (id, document_id, item_id, name, description, quantity, unit, unit_price, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [di.id, di.document_id, di.item_id ?? null, di.name, di.description ?? null, di.quantity ?? 1, di.unit ?? "ชิ้น", di.unit_price ?? 0, di.sort_order ?? 0]
      );
      documentItemsAdded++;
    }

    let defaultsAdded = 0, defaultsSkipped = 0;
    for (const dd of payload.document_defaults || []) {
      const companyId = dd.company_id ?? 1;
      if (await exists("SELECT 1 FROM document_defaults WHERE company_id = $1 AND doc_type = $2", [companyId, dd.doc_type])) {
        defaultsSkipped++;
        continue;
      }
      await client.query(
        `INSERT INTO document_defaults
           (company_id, doc_type, vat_enabled, vat_rate, discount_enabled, note_enabled, combined_receipt, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
        [companyId, dd.doc_type, dd.vat_enabled ?? false, dd.vat_rate ?? 7, dd.discount_enabled ?? false, dd.note_enabled ?? false, dd.combined_receipt ?? false, dd.updated_at ?? null]
      );
      defaultsAdded++;
    }

    // sync sequence กันชนกับ id ใหม่ที่เพิ่งเพิ่มเข้าไป (ของเดิมไม่ได้ถูกลบ MAX(id) จึงครอบคลุมทั้งของเก่า+ใหม่อยู่แล้ว)
    await client.query("SELECT setval('customers_id_seq', COALESCE((SELECT MAX(id) FROM customers), 1))");
    await client.query("SELECT setval('items_id_seq', COALESCE((SELECT MAX(id) FROM items), 1))");
    await client.query("SELECT setval('documents_id_seq', COALESCE((SELECT MAX(id) FROM documents), 1))");
    await client.query("SELECT setval('document_items_id_seq', COALESCE((SELECT MAX(id) FROM document_items), 1))");

    return {
      customers: { added: customersAdded, skipped: customersSkipped },
      items: { added: itemsAdded, skipped: itemsSkipped },
      documents: { added: documentsAdded, skipped: documentsSkipped },
      document_items: { added: documentItemsAdded, skipped: documentItemsSkipped },
      document_defaults: { added: defaultsAdded, skipped: defaultsSkipped },
    };
  });
}

// ------------------------------------------------------------- restore ----
// mode=replace (ค่าเริ่มต้น): ล้างข้อมูลเดิมทั้งหมดแล้วแทนที่ด้วยไฟล์นี้
// mode=merge: ไม่ลบอะไรเลย เพิ่มเฉพาะรายการที่ยังไม่มีอยู่แล้วในระบบ
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

  const mode = req.body?.mode === "merge" ? "merge" : "replace";

  try {
    const summary = mode === "merge" ? await restoreMerge(payload) : await restoreReplace(payload);
    res.json({ ok: true, mode, restored: summary });
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
