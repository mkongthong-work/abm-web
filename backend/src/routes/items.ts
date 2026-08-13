import { Router } from "express";
import { many, one, run } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const r = await many("SELECT * FROM items ORDER BY id");
  res.json(r);
});

router.post("/", async (req, res) => {
  const { name, description, unit, unit_price } = req.body;
  if (!name || unit_price === undefined) {
    return res.status(400).json({ error: "ต้องระบุชื่อสินค้าและราคา" });
  }
  const r = await one(
    `INSERT INTO items (name, description, unit, unit_price)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, description ?? null, unit ?? "ชิ้น", Number(unit_price)]
  );
  res.status(201).json(r);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, unit, unit_price } = req.body;
  await run(
    `UPDATE items SET
       name = COALESCE($1, name), description = COALESCE($2, description),
       unit = COALESCE($3, unit), unit_price = COALESCE($4, unit_price)
     WHERE id = $5`,
    [name ?? null, description ?? null, unit ?? null, unit_price ?? null, id]
  );
  const r = await one("SELECT * FROM items WHERE id = $1", [id]);
  if (!r) return res.status(404).json({ error: "ไม่พบสินค้า" });
  res.json(r);
});

router.delete("/:id", async (req, res) => {
  await run("DELETE FROM items WHERE id = $1", [Number(req.params.id)]);
  res.status(204).end();
});

export default router;
