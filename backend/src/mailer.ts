import nodemailer from "nodemailer";

// ---- ส่งอีเมลข้อมูลสำรอง (backup) ผ่าน Gmail SMTP ----
// ต้องตั้งค่า ENV: SMTP_USER (อีเมล Gmail), SMTP_PASS (App Password 16 หลัก ไม่ใช่รหัสผ่าน Gmail ปกติ)
// ปลายทางส่งถึง BACKUP_EMAIL_TO ถ้าตั้งไว้ ไม่งั้น fallback ไปที่ SMTP_USER เอง (ส่งหาตัวเอง)

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า SMTP_USER / SMTP_PASS — ตั้งเป็นอีเมล Gmail และ App Password (ไม่ใช่รหัสผ่านปกติ)"
    );
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

export async function sendBackupEmail(attachmentBuffer: Buffer, filename: string) {
  const user = process.env.SMTP_USER;
  const to = process.env.BACKUP_EMAIL_TO || user;
  if (!to) {
    throw new Error("ไม่พบปลายทางอีเมล — ตั้งค่า BACKUP_EMAIL_TO หรือ SMTP_USER");
  }
  const t = getTransport();
  const now = new Date();
  await t.sendMail({
    from: `"ABM Backup" <${user}>`,
    to,
    subject: `[ABM] ข้อมูลสำรองประจำวันที่ ${now.toLocaleDateString("th-TH")}`,
    text:
      "ไฟล์แนบคือข้อมูลสำรองทั้งหมดของระบบ ABM (รูปแบบ JSON)\n" +
      "หากต้องกู้คืนข้อมูล ให้เข้าหน้า \"ตั้งค่า\" ในระบบ แล้วอัปโหลดไฟล์นี้ผ่านเมนู \"กู้คืนข้อมูลจากไฟล์สำรอง\"\n\n" +
      "อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ",
    attachments: [
      {
        filename,
        content: attachmentBuffer,
        contentType: "application/json",
      },
    ],
  });
}
