import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { one } from "../db";

const router = Router();

// รหัสผ่านเดียวที่ทุกคนในบริษัทใช้ร่วมกัน (ยังไม่ใช่ระบบผู้ใช้แยกรายบุคคล — เป็นด่านกันเบื้องต้นก่อนขึ้น Render)
// ตั้งได้ 2 ทาง: จากหน้าตั้งค่าบริษัทในแอป (เก็บลงตาราง company คอลัมน์ access_pin) หรือ ENV ABM_ACCESS_PIN
// ถ้าตั้งไว้ทั้งคู่ ค่าจากฐานข้อมูลชนะ — ถ้าไม่ตั้งเลยทั้งคู่ จะไม่บังคับล็อกอิน
//
// cache ค่า PIN ไว้ในหน่วยความจำ กันไม่ให้ query ฐานข้อมูลทุก request (ทุกหน้าเรียก API หลายตัวพร้อมกัน)
// ทุกครั้งที่มีการบันทึกค่าใหม่จากหน้าตั้งค่า ต้องเรียก invalidatePinCache() เพื่อให้โหลดค่าล่าสุดรอบถัดไป
let cachedPin: string | null | undefined = undefined;

export function invalidatePinCache() {
  cachedPin = undefined;
}

/** ใช้จากที่อื่นได้ด้วย (เช่น company.ts ตอนจะเปลี่ยน PIN ต้องตรวจ PIN เดิมก่อน) */
export async function getConfiguredPin(): Promise<string | null> {
  if (cachedPin !== undefined) return cachedPin;
  let dbPin: string | null = null;
  try {
    const row = await one<{ access_pin: string | null }>("SELECT access_pin FROM company WHERE id = 1");
    dbPin = row?.access_pin || null;
  } catch {
    // ฐานข้อมูลยังไม่พร้อม/ตารางยังไม่มีคอลัมน์นี้ — ไม่ให้ล้มทั้งระบบ ใช้ ENV แทนไปก่อน
  }
  cachedPin = dbPin || process.env.ABM_ACCESS_PIN || null;
  return cachedPin;
}

// token คำนวณจาก PIN ล้วน ๆ (ไม่มีวันหมดอายุ) — ถ้าสงสัยว่ารั่ว แค่เปลี่ยนค่า PIN (จากหน้าตั้งค่า หรือ ENV)
// token เดิมทุกอันที่เคยแจกไปจะใช้ไม่ได้ทันที
function expectedToken(pin: string): string {
  return crypto.createHmac("sha256", pin).update("abm-session-v1").digest("hex");
}

router.post("/login", async (req: Request, res: Response) => {
  const pin = await getConfiguredPin();
  if (!pin) {
    return res.status(500).json({ error: "ยังไม่ได้ตั้งรหัส PIN — ตั้งได้จากหน้าตั้งค่าบริษัท" });
  }
  const { pin: submitted } = req.body || {};
  if (typeof submitted !== "string" || submitted !== pin) {
    return res.status(401).json({ error: "PIN ไม่ถูกต้อง" });
  }
  res.json({ token: expectedToken(pin) });
});

/** ป้องกันทุก route ข้อมูลจริง (ยกเว้น /api/health และ /api/auth/login) ด้วย token ที่ได้จาก /login
 *  รับ token ได้ 2 ทาง: header X-ABM-Token (เรียกผ่าน HttpClient ปกติ) หรือ query string ?token=
 *  (จำเป็นสำหรับลิงก์ดาวน์โหลด PDF/Excel ที่เปิดผ่าน <a href> ตรง ๆ ซึ่งแนบ header เองไม่ได้) */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const pin = await getConfiguredPin();
  if (!pin) return next(); // ยังไม่ตั้ง PIN เลย = ยังไม่เปิดใช้การล็อก (สะดวกตอน dev ในเครื่อง)
  const token = req.header("X-ABM-Token") || (req.query.token as string | undefined);
  if (token && token === expectedToken(pin)) return next();
  res.status(401).json({ error: "unauthorized" });
}

export default router;
