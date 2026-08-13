import { Router } from "express";
import ExcelJS from "exceljs";
import multer from "multer";
import { db, rows } from "../db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ------------------------------------------------------------- export ----
router.get("/export", async (req, res) => {
  const workbook = new ExcelJS.Workbook();

  const customers = rows(db.prepare("SELECT * FROM customers ORDER BY id").all());
  const wsCustomers = workbook.addWorksheet("Customers");
  wsCustomers.columns = [
    { header: "id", key: "id", width: 8 },
    { header: "name", key: "name", width: 30 },
    { header: "address", key: "address", width: 40 },
    { header: "tax_id", key: "tax_id", width: 18 },
    { header: "phone", key: "phone", width: 16 },
    { header: "email", key: "email", width: 24 },
  ];
  wsCustomers.addRows(customers);

  const items = rows(db.prepare("SELECT * FROM items ORDER BY id").all());
  const wsItems = workbook.addWorksheet("Items");
  wsItems.columns = [
    { header: "id", key: "id", width: 8 },
    { header: "name", key: "name", width: 30 },
    { header: "description", key: "description", width: 30 },
    { header: "unit", key: "unit", width: 10 },
    { header: "unit_price", key: "unit_price", width: 14 },
  ];
  wsItems.addRows(items);

  const documents = rows(
    db
      .prepare(
        `SELECT d.*, c.name AS customer_name FROM documents d
         JOIN customers c ON c.id = d.customer_id ORDER BY d.id`
      )
      .all()
  );
  const wsDocs = workbook.addWorksheet("Documents");
  wsDocs.columns = [
    { header: "id", key: "id", width: 8 },
    { header: "doc_type", key: "doc_type", width: 12 },
    { header: "doc_number", key: "doc_number", width: 16 },
    { header: "customer_name", key: "customer_name", width: 26 },
    { header: "issue_date", key: "issue_date", width: 14 },
    { header: "due_date", key: "due_date", width: 14 },
    { header: "vat_rate", key: "vat_rate", width: 10 },
    { header: "discount", key: "discount", width: 10 },
    { header: "status", key: "status", width: 10 },
    { header: "note", key: "note", width: 30 },
  ];
  wsDocs.addRows(documents);

  const docItems = rows(
    db.prepare("SELECT * FROM document_items ORDER BY document_id, sort_order").all()
  );
  const wsDocItems = workbook.addWorksheet("DocumentItems");
  wsDocItems.columns = [
    { header: "id", key: "id", width: 8 },
    { header: "document_id", key: "document_id", width: 12 },
    { header: "name", key: "name", width: 30 },
    { header: "description", key: "description", width: 30 },
    { header: "quantity", key: "quantity", width: 10 },
    { header: "unit", key: "unit", width: 10 },
    { header: "unit_price", key: "unit_price", width: 14 },
  ];
  wsDocItems.addRows(docItems);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="abm-export.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

// ------------------------------------------------------------- import ----
// นำเข้าเฉพาะ Customers และ Items แบบ upsert ตาม id (POC: เพื่อความปลอดภัยของ documents
// ซึ่งมีความสัมพันธ์ซับซ้อนกว่า จึงยังไม่รองรับ import เอกสารในเวอร์ชันนี้)
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "กรุณาแนบไฟล์ Excel" });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer as any);

  let customerCount = 0;
  let itemCount = 0;

  const wsCustomers = workbook.getWorksheet("Customers");
  if (wsCustomers) {
    const upsert = db.prepare(
      `INSERT INTO customers (id, name, address, tax_id, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, address=excluded.address, tax_id=excluded.tax_id,
         phone=excluded.phone, email=excluded.email`
    );
    wsCustomers.eachRow((r, rowNumber) => {
      if (rowNumber === 1) return; // header
      const [, id, name, address, tax_id, phone, email] = r.values as any[];
      if (!name) return;
      upsert.run(id ?? null, name, address ?? null, tax_id ?? null, phone ?? null, email ?? null);
      customerCount++;
    });
  }

  const wsItems = workbook.getWorksheet("Items");
  if (wsItems) {
    const upsert = db.prepare(
      `INSERT INTO items (id, name, description, unit, unit_price)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, description=excluded.description, unit=excluded.unit,
         unit_price=excluded.unit_price`
    );
    wsItems.eachRow((r, rowNumber) => {
      if (rowNumber === 1) return;
      const [, id, name, description, unit, unit_price] = r.values as any[];
      if (!name) return;
      upsert.run(id ?? null, name, description ?? null, unit ?? "ชิ้น", Number(unit_price) || 0);
      itemCount++;
    });
  }

  res.json({ ok: true, customers_imported: customerCount, items_imported: itemCount });
});

export default router;
