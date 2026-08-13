import { Router } from "express";
import { one, run } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const r = await one("SELECT * FROM company WHERE id = 1");
  res.json(r);
});

router.put("/", async (req, res) => {
  const { name, address, tax_id, phone, email, logo_path } = req.body;
  await run(
    `UPDATE company SET
       name = COALESCE($1, name),
       address = COALESCE($2, address),
       tax_id = COALESCE($3, tax_id),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       logo_path = COALESCE($6, logo_path)
     WHERE id = 1`,
    [name ?? null, address ?? null, tax_id ?? null, phone ?? null, email ?? null, logo_path ?? null]
  );
  const r = await one("SELECT * FROM company WHERE id = 1");
  res.json(r);
});

export default router;
