import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import { db, row, rows } from "../db";
import { generatePdf } from "../pdf";

const router = Router();

const DOC_LABELS: Record<string, { th: string; prefix: string }> = {
  quotation: { th: "ใบเสนอราคา", prefix: "QT" },
  invoice: { th: "ใบแจ้งหนี้", prefix: "INV" },
  receipt: { th: "ใบเสร็จรับเงิน", prefix: "RC" },
};

function nextDocNumber(docType: string): string {
  const prefix = DOC_LABELS[docType].prefix;
  const year = new Date().getFullYear().toString();
  const like = `${prefix}-${year}-%`;
  const r: any = db
    .prepare("SELECT doc_number FROM documents WHERE doc_number LIKE ? ORDER BY id DESC LIMIT 1")
    .get(like);
  let seq = 1;
  if (r) {
    const last = parseInt(r.doc_number.split("-").pop(), 10);
    seq = last + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function calcTotals(items: any[], discount: number, vatRate: number) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const afterDiscount = subtotal - discount;
  const vat = (afterDiscount * vatRate) / 100;
  const total = afterDiscount + vat;
  return { subtotal, discount, vat, total };
}

router.get("/", (req, res) => {
  const type = req.query.type as string | undefined;
  let q = `SELECT d.*, c.name AS customer_name,
              COALESCE((SELECT SUM(quantity * unit_price) FROM document_items WHERE document_id = d.id), 0) AS subtotal
            FROM documents d
            JOIN customers c ON c.id = d.customer_id`;
  const params: any[] = [];
  if (type) {
    q += " WHERE d.doc_type = ?";
    params.push(type);
  }
  q += " ORDER BY d.id DESC";
  const r: any[] = db.prepare(q).all(...params);
  const withTotals = r.map((d) => {
    const afterDiscount = d.subtotal - (d.discount || 0);
    const vat = (afterDiscount * (d.vat_rate || 0)) / 100;
    return { ...d, total: afterDiscount + vat };
  });
  res.json(withTotals);
});

router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const doc: any = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) return res.status(404).json({ error: "ไม่พบเอกสาร" });
  const items = rows(
    db.prepare("SELECT * FROM document_items WHERE document_id = ? ORDER BY sort_order").all(id)
  );
  const totals = calcTotals(items, doc.discount, doc.vat_rate);
  res.json({ ...row(doc), items, ...totals });
});

router.post("/", (req, res) => {
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
  } = req.body;

  if (!type || !DOC_LABELS[type]) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });
  const customer: any = db.prepare("SELECT * FROM customers WHERE id = ?").get(customer_id);
  if (!customer) return res.status(400).json({ error: "ไม่พบลูกค้า" });
  if (!Array.isArray(lines) || lines.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });

  const finalDocNumber = doc_number || nextDocNumber(type);
  const finalIssueDate = issue_date || new Date().toISOString().slice(0, 10);
  let finalDueDate = due_date || null;
  if (!finalDueDate && type === "invoice") {
    const d = new Date(finalIssueDate);
    d.setDate(d.getDate() + 15);
    finalDueDate = d.toISOString().slice(0, 10);
  }

  const result = db
    .prepare(
      `INSERT INTO documents (doc_type, doc_number, customer_id, issue_date, due_date,
                               ref_doc_id, vat_rate, discount, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    )
    .run(
      type,
      finalDocNumber,
      customer_id,
      finalIssueDate,
      finalDueDate,
      ref_doc_id ?? null,
      vat_rate,
      discount,
      note ?? null
    );
  const docId = result.lastInsertRowid;

  const insertItem = db.prepare(
    `INSERT INTO document_items (document_id, name, description, quantity, unit, unit_price, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  lines.forEach((line: any, idx: number) => {
    insertItem.run(
      docId,
      line.name,
      line.description ?? null,
      Number(line.quantity),
      line.unit ?? "ชิ้น",
      Number(line.unit_price),
      idx
    );
  });

  const doc: any = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId);
  res.status(201).json(row(doc));
});

router.get("/:id/pdf", async (req, res) => {
  const id = Number(req.params.id);
  const doc: any = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) return res.status(404).json({ error: "ไม่พบเอกสาร" });
  const customer: any = db.prepare("SELECT * FROM customers WHERE id = ?").get(doc.customer_id);
  const company: any = db.prepare("SELECT * FROM company WHERE id = 1").get();
  const items = rows(
    db.prepare("SELECT * FROM document_items WHERE document_id = ? ORDER BY sort_order").all(id)
  );
  const totals = calcTotals(items, doc.discount, doc.vat_rate);

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
