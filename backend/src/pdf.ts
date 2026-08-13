import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PDF_SERVICE_DIR = path.join(__dirname, "..", "pdf-service");

// ถ้ามี virtual environment อยู่ใน pdf-service/venv ให้ใช้ python3 จาก venv นั้นก่อน
// (กัน error "externally-managed-environment" บน macOS/Homebrew Python)
// ตั้งค่า path เองได้ผ่าน ABM_PYTHON_BIN
function resolvePythonBin(): string {
  if (process.env.ABM_PYTHON_BIN) return process.env.ABM_PYTHON_BIN;
  const venvPython = path.join(PDF_SERVICE_DIR, "venv", "bin", "python3");
  if (fs.existsSync(venvPython)) return venvPython;
  return "python3";
}

const PYTHON_BIN = resolvePythonBin();

export interface PdfPayload {
  doc: any;
  customer: any;
  company: any;
  items: any[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  out_path: string;
}

export function generatePdf(payload: PdfPayload): Promise<void> {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, ["generate.py"], { cwd: PDF_SERVICE_DIR });
    let stderr = "";
    py.stderr.on("data", (d) => (stderr += d.toString()));
    py.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PDF generation failed (exit ${code}): ${stderr}`));
    });
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}
