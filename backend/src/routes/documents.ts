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

async function nextDocNumber(docType: string): Promise<string> {
  const prefix = DOC_LABELS[docType].prefix;
  const year = new Date().getFullYear().toString();
  const like = `${prefix}-${year}-%`;
  const r = await one<{ doc_number: string }>(
    "SELECT doc_number FROM documents WHERE doc_number LIKE $1 ORDER BY id DESC LIMIT 1",
    [like]
  );
  let seq = 1;
  if (r) {
    const last = parseInt(r.doc_number.split("-").pop() as string, 10);
    seq = last + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function calcTotals(items: any[], discount: number, vatRate: number) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const afterDiscount = subtotal - discount;
  const vat = (afterDiscount * vatRate) / 100;
  const total = afterDiscount + vat;
  return { subtotal, discount, vat, total };
}

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
  } = req.body;

  if (!type || !DOC_LABELS[type]) return res.status(400).json({ error: "ประเภทเอกสารไม่ถูกต้อง" });
  const customer = await one("SELECT * FROM customers WHERE id = $1", [customer_id]);
  if (!customer) return res.status(400).json({ error: "ไม่พบลูกค้า" });
  if (!Array.isArray(lines) || lines.length === 0)
    return res.status(400).json({ error: "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ" });

  const finalDocNumber = doc_number || (await nextDocNumber(type));
  const finalIssueDate = issue_date || new Date().toISOString().slice(0, 10);
  let finalDueDate = due_date || null;
  if (!finalDueDate && type === "invoice") {
    const d = new Date(finalIssueDate);
    d.setDate(d.getDate() + 15);
    finalDueDate = d.toISOString().slice(0, 10);
  }

  const doc = await one<any>(
    `INSERT INTO documents (doc_type, doc_number, customer_id, issue_date, due_date,
                             ref_doc_id, vat_rate, discount, note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
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
