import { Router } from "express";
import { many, one, run } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const r = await many("SELECT * FROM customers ORDER BY id");
  res.json(r);
});

router.get("/:id", async (req, res) => {
  const r = await one("SELECT * FROM customers WHERE id = $1", [Number(req.params.id)]);
  if (!r) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(r);
});

router.post("/", async (req, res) => {
  const { name, address, tax_id, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: "ต้องระบุชื่อลูกค้า" });
  const r = await one(
    `INSERT INTO customers (name, address, tax_id, phone, email)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, address ?? null, tax_id ?? null, phone ?? null, email ?? null]
  );
  res.status(201).json(r);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address, tax_id, phone, email } = req.body;
  await run(
    `UPDATE customers SET
       name = COALESCE($1, name), address = COALESCE($2, address),
       tax_id = COALESCE($3, tax_id), phone = COALESCE($4, phone), email = COALESCE($5, email)
     WHERE id = $6`,
    [name ?? null, address ?? null, tax_id ?? null, phone ?? null, email ?? null, id]
  );
  const r = await one("SELECT * FROM customers WHERE id = $1", [id]);
  if (!r) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(r);
});

router.delete("/:id", async (req, res) => {
  await run("DELETE FROM customers WHERE id = $1", [Number(req.params.id)]);
  res.status(204).end();
});

export default router;
