import { Router } from "express";
import { db, row } from "../db";

const router = Router();

router.get("/", (req, res) => {
  const r = db.prepare("SELECT * FROM company WHERE id = 1").get();
  res.json(row(r));
});

router.put("/", (req, res) => {
  const { name, address, tax_id, phone, email, logo_path } = req.body;
  db.prepare(
    `UPDATE company SET
       name = COALESCE(?, name),
       address = COALESCE(?, address),
       tax_id = COALESCE(?, tax_id),
       phone = COALESCE(?, phone),
       email = COALESCE(?, email),
       logo_path = COALESCE(?, logo_path)
     WHERE id = 1`
  ).run(name ?? null, address ?? null, tax_id ?? null, phone ?? null, email ?? null, logo_path ?? null);
  const r = db.prepare("SELECT * FROM company WHERE id = 1").get();
  res.json(row(r));
});

export default router;
