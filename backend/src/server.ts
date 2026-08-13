import cors from "cors";
import express from "express";
import companyRouter from "./routes/company";
import customersRouter from "./routes/customers";
import itemsRouter from "./routes/items";
import documentsRouter from "./routes/documents";
import excelRouter from "./routes/excel";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/company", companyRouter);
app.use("/api/customers", customersRouter);
app.use("/api/items", itemsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/excel", excelRouter); // /api/excel/export, /api/excel/import

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[abm-backend] listening on http://localhost:${PORT}`);
});
