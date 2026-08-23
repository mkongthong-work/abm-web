import "dotenv/config";
import cors from "cors";
import express from "express";
import { initDb } from "./db";
import companyRouter from "./routes/company";
import customersRouter from "./routes/customers";
import itemsRouter from "./routes/items";
import documentsRouter from "./routes/documents";
import documentDefaultsRouter from "./routes/documentDefaults";
import excelRouter from "./routes/excel";
import backupRouter from "./routes/backup";
import authRouter, { requireAuth } from "./routes/auth";

async function main() {
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter); // /api/auth/login — ไม่ต้องผ่าน requireAuth (ใช้ล็อกอินเข้าระบบ)
  app.use("/api/company", requireAuth, companyRouter);
  app.use("/api/customers", requireAuth, customersRouter);
  app.use("/api/items", requireAuth, itemsRouter);
  app.use("/api/documents", requireAuth, documentsRouter);
  app.use("/api/document-defaults", requireAuth, documentDefaultsRouter);
  app.use("/api/excel", requireAuth, excelRouter); // /api/excel/export, /api/excel/import
  // backupRouter mount แบบไม่ผ่าน requireAuth ตรงนี้ เพราะ /run ต้องให้ cron ภายนอกเรียกได้โดยไม่มี token ล็อกอิน
  // (ตรวจสิทธิ์ด้วย secret ของตัวเองแทน) ส่วน /export และ /restore มี requireAuth ครอบไว้เฉพาะจุดภายใน route เอง
  app.use("/api/backup", backupRouter);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[abm-backend] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[abm-backend] เริ่มระบบไม่สำเร็จ:", err.message);
  process.exit(1);
});
