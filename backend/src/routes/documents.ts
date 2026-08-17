import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { many, one, run } from "../db";
import { generatePdf } from "../pdf";

const router = Router();

const DOC_LABELS: Record<string, { th: string; prefix: string }> = {
  quotation: { th: "ใบเสนอราคา", prefix: "QT" },
  invoice: { th: "ใบแจ้งหนี้", prefix: "INV" },
  receipt: { th: "ใบเสร็จรับเงิน", prefix: "RC" },
};

const VALID_STATUSES = ["draft", "sent", "paid", "void"];

// ข้อความลงชื่อท้ายเอกสารเริ่มต้น (ผู้ใช้แก้ไขได้ต่อเอกสาร หรือปิดฝั่งใดฝั่งหนึ่งได้)
const DEFAULT_SIGN_LEFT = "ผู้เสนอราคา / ผู้ออกเอกสาร";
const DEFAULT_SIGN_RIGHT = "ผู้อนุมัติ / ผู้รับเอกสาร";

// รูปแบบเลขที่เอกสาร: PREFIX-YYYY-MM-XXXX เช่น QT-2026-08-0001
// อิงตามเดือนของ "วันที่ออกเอกสาร" (ไม่ใช่วันที่ปัจจุบันของเครื่อง) — รันเลขใหม่ทุกเดือนตามวันที่นั้น ๆ
async function nextDocNumber(docType: string, refDate: Date = new Date()): Promise<string> {
  const prefix = DOC_LABELS[docType].prefix;
  const year = refDate.getFullYear().toString();
  const month = String(refDate.getMonth() + 1).padStart(2, "0");
  const like = `${prefix}-${year}-${month}-%`;
  const r = await one<{ doc_number: string }>(
    "SELECT doc_number FROM documents WHERE doc_number LIKE $1 ORDER BY id DESC LIMIT 1",
    [like]
  );
  let seq = 1;
  if (r) {
    const last = parseInt(r.doc_number.split("-").pop() as string, 10);
    seq = last + 1;
  }
  return `${prefix}-${year}-${month}-${String(seq).padStart(4, "0")}`;
}

function calcTotals(items: any[], discount: number, vatRate: number) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const afterDiscount = subtotal - discount;
  const vat = (afterDiscount * vatRate) / 100;
  const total = afterDiscount + vat;
  return { subtotal, discount, vat, total };
}

// สร้าง PDF ตัวอย่างจากข้อมูลในฟอร์ม โดยยังไม่บันทึกลงฐานข้อมูล
router.post("/preview", async (req, res) => {
  const {
    type,
    customer_id,
    lines,
    vat_rate = 7,
    discount = 0,
    note,
    issue_date,
    due_date,
    status,
    sign_left_label,
    sign_right_label,
    show_quantity,
    show_unit,
  } = req.body;

  if (!type || !DOC_LABELS[type]) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });
  const customer = await one("SELECT * FROM customers WHERE id = $1", [customer_id]);
  if (!customer) return res.status(400).json({ error: "ไม่พบลูกค้า" });
  if (!Array.isArray(lines) || lines.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });

  const company = await one("SELECT * FROM company WHERE id = 1");
  const finalIssueDate = issue_date || new Date().toISOString().slice(0, 10);
  let finalDueDate: string | null = due_date !== undefined ? due_date || null : null;
  if (due_date === undefined && type === "invoice") {
    const d = new Date(finalIssueDate);
    d.setDate(d.getDate() + 15);
    finalDueDate = d.toISOString().slice(0, 10);
  }

  const previewRefDate = new Date(finalIssueDate);
  const doc = {
    doc_type: type,
    doc_number: `${DOC_LABELS[type].prefix}-${previewRefDate.getFullYear()}-${String(previewRefDate.getMonth() + 1).padStart(2, "0")}-ตัวอย่าง`,
    issue_date: finalIssueDate,
    due_date: finalDueDate,
    vat_rate: Number(vat_rate),
    discount: Number(discount),
    note: note ?? null,
    status: status || "draft",
    sign_left_label: sign_left_label !== undefined ? sign_left_label : DEFAULT_SIGN_LEFT,
    sign_right_label: sign_right_label !== undefined ? sign_right_label : DEFAULT_SIGN_RIGHT,
    show_quantity: show_quantity !== undefined ? !!show_quantity : true,
    show_unit: show_unit !== undefined ? !!show_unit : true,
  };
  const totals = calcTotals(lines, Number(discount), Number(vat_rate));

  const tmpOut = path.join(os.tmpdir(), `preview-${Date.now()}.pdf`);
  try {
    await generatePdf({
      doc,
      customer,
      company,
      items: lines,
      subtotal: totals.subtotal,
      discount: totals.discount,
      vat: totals.vat,
      total: totals.total,
      out_path: tmpOut,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview.pdf"`);
    fs.createReadStream(tmpOut).pipe(res).on("close", () => fs.unlink(tmpOut, () => {}));
  } catch (err: any) {
    res.status(500).json({ error: "สร้างตัวอย่าง PDF ไม่สำเร็จ", detail: err.message });
  }
});

router.get("/", async (req, res) => {
  const type = req.query.type as string | undefined;
  let q = `SELECT d.*, c.name AS customer_name,
              COALESCE((SELECT SUM(quantity * unit_price) FROM document_items WHERE document_id = d.id), 0) AS subtotal
            FROM documents d
            JOIN customers c ON c.id = d.customer_id`;
  const params: any[] = [];
  if (type) {
    q += " WHERE d.doc_type = $1";
    params.push(type);
  }
  q += " ORDER BY d.id DESC";
  const r = await many<any>(q, params);
  const withTotals = r.map((d) => {
    const afterDiscount = Number(d.subtotal) - Number(d.discount || 0);
    const vat = (afterDiscount * Number(d.vat_rate || 0)) / 100;
    return { ...d, total: afterDiscount + vat };
  });
  res.json(withTotals);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const doc = await one<any>("SELECT * FROM documents WHERE id = $1", [id]);
  if (!doc) return res.status(404).json({ error: "ไม่พบเอกสาร" });
  const items = await many(
    "SELECT * FROM document_items WHERE document_id = $1 ORDER BY sort_order",
    [id]
  );
  const totals = calcTotals(items, Number(doc.discount), Number(doc.vat_rate));
  res.json({ ...doc, items, ...totals });
});

router.post("/", async (req, res) => {
  const {
    type,
    customer_id,
    lines, // [{ name, quantity, unit, unit_price, description? }]
    vat_rate = 7,
    discount = 0,
    note,
    issue_date,
    due_date,
    doc_number,
    ref_doc_id,
    status,
    sign_left_label,
    sign_right_label,
    show_quantity,
    show_unit,
  } = req.body;

  if (!type || !DOC_LABELS[type]) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });
  const customer = await one("SELECT * FROM customers WHERE id = $1", [customer_id]);
  if (!customer) return res.status(400).json({ error: "ไม่พบลูกค้า" });
  if (!Array.isArray(lines) || lines.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "สถานะเอกสารไม่ถูกต้อง" });
  }

  const finalStatus = status || "draft";
  const finalSignLeft = sign_left_label !== undefined ? sign_left_label : DEFAULT_SIGN_LEFT;
  const finalSignRight = sign_right_label !== undefined ? sign_right_label : DEFAULT_SIGN_RIGHT;
  const finalShowQuantity = show_quantity !== undefined ? !!show_quantity : true;
  const finalShowUnit = show_unit !== undefined ? !!show_unit : true;
  const finalIssueDate = issue_date || new Date().toISOString().slice(0, 10);
  // เลขที่เอกสารรันตามเดือนของ "วันที่ออกเอกสาร" ที่เลือก ไม่ใช่วันที่ปัจจุบันของเครื่อง
  const finalDocNumber = doc_number || (await nextDocNumber(type, new Date(finalIssueDate)));
  let finalDueDate: string | null = due_date !== undefined ? due_date || null : null;
  if (due_date === undefined && type === "invoice") {
    const d = new Date(finalIssueDate);
    d.setDate(d.getDate() + 15);
    finalDueDate = d.toISOString().slice(0, 10);
  }

  const doc = await one<any>(
    `INSERT INTO documents (doc_type, doc_number, customer_id, issue_date, due_date,
                             ref_doc_id, vat_rate, discount, note, status,
                             sign_left_label, sign_right_label, show_quantity, show_unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      type,
      finalDocNumber,
      customer_id,
      finalIssueDate,
      finalDueDate,
      ref_doc_id ?? null,
      vat_rate,
      discount,
      note ?? null,
      finalStatus,
      finalSignLeft,
      finalSignRight,
      finalShowQuantity,
      finalShowUnit,
    ]
  );
  const docId = doc!.id;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    await run(
      `INSERT INTO document_items (document_id, name, description, quantity, unit, unit_price, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        docId,
        line.name,
        line.description ?? null,
        Number(line.quantity),
        line.unit ?? "ชิ้น",
        Number(line.unit_price),
        idx,
      ]
    );
  }

  res.status(201).json(doc);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await one<any>("SELECT * FROM documents WHERE id = $1", [id]);
  if (!existing) return res.status(404).json({ error: "ไม่พบเอกสาร" });

  const {
    type,
    customer_id,
    lines, // [{ name, quantity, unit, unit_price, description? }] — ถ้าส่งมาจะแทนที่รายการเดิมทั้งหมด
    vat_rate,
    discount,
    note,
    issue_date,
    due_date,
    status,
    sign_left_label,
    sign_right_label,
    show_quantity,
    show_unit,
  } = req.body;

  if (customer_id !== undefined) {
    const customer = await one("SELECT * FROM customers WHERE id = $1", [customer_id]);
    if (!customer) return res.status(400).json({ error: "ไม่พบลูกค้า" });
  }
  if (lines !== undefined && (!Array.isArray(lines) || lines.length === 0)) {
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });
  }
  if (type !== undefined && !DOC_LABELS[type]) {
    return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "สถานะเอกสารไม่ถูกต้อง" });
  }

  // ต้องออกเลขที่เอกสารใหม่เมื่อ: เปลี่ยนประเภทเอกสาร (prefix เปลี่ยน) หรือแก้วันที่ออกเอกสาร
  // ย้ายไปคนละเดือนกับเดิม (เลขที่รันตามเดือนของวันที่ออกเอกสาร) — ถ้าย้ายไปเดือนเดิมไม่ต้องออกเลขใหม่
  let newDocType: string | null = null;
  let newDocNumber: string | null = null;
  const finalTypeForNumber = type !== undefined ? type : existing.doc_type;
  const typeChanged = type !== undefined && type !== existing.doc_type;
  const dateMovedMonth =
    issue_date !== undefined && issue_date.slice(0, 7) !== String(existing.issue_date).slice(0, 7);
  if (typeChanged) newDocType = type;
  if (typeChanged || dateMovedMonth) {
    const refDate = new Date(issue_date !== undefined ? issue_date : existing.issue_date);
    newDocNumber = await nextDocNumber(finalTypeForNumber, refDate);
  }

  await run(
    `UPDATE documents SET
       doc_type = COALESCE($1, doc_type),
       doc_number = COALESCE($2, doc_number),
       customer_id = COALESCE($3, customer_id),
       vat_rate = COALESCE($4, vat_rate),
       discount = COALESCE($5, discount),
       note = COALESCE($6, note),
       issue_date = COALESCE($7, issue_date),
       due_date = COALESCE($8, due_date),
       status = COALESCE($9, status),
       sign_left_label = COALESCE($10, sign_left_label),
       sign_right_label = COALESCE($11, sign_right_label),
       show_quantity = COALESCE($12, show_quantity),
       show_unit = COALESCE($13, show_unit)
     WHERE id = $14`,
    [
      newDocType,
      newDocNumber,
      customer_id ?? null,
      vat_rate ?? null,
      discount ?? null,
      note ?? null,
      issue_date ?? null,
      due_date ?? null,
      status ?? null,
      sign_left_label ?? null,
      sign_right_label ?? null,
      show_quantity ?? null,
      show_unit ?? null,
      id,
    ]
  );

  if (Array.isArray(lines)) {
    await run("DELETE FROM document_items WHERE document_id = $1", [id]);
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      await run(
        `INSERT INTO document_items (document_id, name, description, quantity, unit, unit_price, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          line.name,
          line.description ?? null,
          Number(line.quantity),
          line.unit ?? "ชิ้น",
          Number(line.unit_price),
          idx,
        ]
      );
    }
  }

  const doc = await one<any>("SELECT * FROM documents WHERE id = $1", [id]);
  const items = await many(
    "SELECT * FROM document_items WHERE document_id = $1 ORDER BY sort_order",
    [id]
  );
  const totals = calcTotals(items, Number(doc!.discount), Number(doc!.vat_rate));
  res.json({ ...doc, items, ...totals });
});

router.get("/:id/pdf", async (req, res) => {
  const id = Number(req.params.id);
  const doc = await one<any>("SELECT * FROM documents WHERE id = $1", [id]);
  if (!doc) return res.status(404).json({ error: "ไม่พบเอกสาร" });
  const customer = await one("SELECT * FROM customers WHERE id = $1", [doc.customer_id]);
  const company = await one("SELECT * FROM company WHERE id = 1");
  const items = await many(
    "SELECT * FROM document_items WHERE document_id = $1 ORDER BY sort_order",
    [id]
  );
  const totals = calcTotals(items, Number(doc.discount), Number(doc.vat_rate));

  const tmpOut = path.join(os.tmpdir(), `${doc.doc_number}-${Date.now()}.pdf`);
  try {
    await generatePdf({
      doc,
      customer,
      company,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      vat: totals.vat,
      total: totals.total,
      out_path: tmpOut,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.doc_number}.pdf"`);
    fs.createReadStream(tmpOut).pipe(res).on("close", () => fs.unlink(tmpOut, () => {}));
  } catch (err: any) {
    res.status(500).json({ error: "สร้าง PDF ไม่สำเร็จ", detail: err.message });
  }
});

export default router;
