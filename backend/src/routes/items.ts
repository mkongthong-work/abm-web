import { Router } from "express";
import { db, row, rows } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const r = db.prepare("SELECT * FROM items ORDER BY id").all();
  res.json(rows(r));
});

router.post("/", (req, res) => {
  const { name, description, unit, unit_price } = req.body;
  if (!name || unit_price === undefined) {
    return res.status(400).json({ error: "ต้องระบุชื่อสินค้าและราคา" });
  }
  const result = db
    .prepare(`INSERT INTO items (name, description, unit, unit_price) VALUES (?, ?, ?, ?)`)
    .run(name, description ?? null, unit ?? "ชิ้น", Number(unit_price));
  const r = db.prepare("SELECT * FROM items WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(row(r));
});

router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, description, unit, unit_price } = req.body;
  db.prepare(
    `UPDATE items SET
       name = COALESCE(?, name), description = COALESCE(?, description),
       unit = COALESCE(?, unit), unit_price = COALESCE(?, unit_price)
     WHERE id = ?`
  ).run(name ?? null, description ?? null, unit ?? null, unit_price ?? null, id);
  const r = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!r) return res.status(404).json({ error: "ไม่พบสินค้า" });
  res.json(row(r));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM items WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

export default router;
