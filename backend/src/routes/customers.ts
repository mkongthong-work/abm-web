import { Router } from "express";
import { db, row, rows } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const r = db.prepare("SELECT * FROM customers ORDER BY id").all();
  res.json(rows(r));
});

router.get("/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(row(r));
});

router.post("/", (req, res) => {
  const { name, address, tax_id, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: "ต้องระบุชื่อลูกค้า" });
  const result = db
    .prepare(`INSERT INTO customers (name, address, tax_id, phone, email) VALUES (?, ?, ?, ?, ?)`)
    .run(name, address ?? null, tax_id ?? null, phone ?? null, email ?? null);
  const r = db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(row(r));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, address, tax_id, phone, email } = req.body;
  db.prepare(
    `UPDATE customers SET
       name = COALESCE(?, name), address = COALESCE(?, address),
       tax_id = COALESCE(?, tax_id), phone = COALESCE(?, phone), email = COALESCE(?, email)
     WHERE id = ?`
  ).run(name ?? null, address ?? null, tax_id ?? null, phone ?? null, email ?? null, id);
  const r = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!r) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(row(r));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM customers WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

export default router;
