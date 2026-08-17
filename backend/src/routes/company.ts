import { Router } from "express";
import { one, run } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const r = await one("SELECT * FROM company WHERE id = 1");
  res.json(r);
});

router.put("/", async (req, res) => {
  const {
    name,
    address,
    tax_id,
    phone,
    email,
    logo_path,
    quotation_color,
    invoice_color,
    receipt_color,
  } = req.body;
  await run(
    `UPDATE company SET
       name = COALESCE($1, name),
       address = COALESCE($2, address),
       tax_id = COALESCE($3, tax_id),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       logo_path = COALESCE($6, logo_path),
       quotation_color = COALESCE($7, quotation_color),
       invoice_color = COALESCE($8, invoice_color),
       receipt_color = COALESCE($9, receipt_color)
     WHERE id = 1`,
    [
      name ?? null,
      address ?? null,
      tax_id ?? null,
      phone ?? null,
      email ?? null,
      logo_path ?? null,
      quotation_color ?? null,
      invoice_color ?? null,
      receipt_color ?? null,
    ]
  );
  const r = await one("SELECT * FROM company WHERE id = 1");
  res.json(r);
});

export default router;
