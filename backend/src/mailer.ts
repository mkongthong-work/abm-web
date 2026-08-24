// ---- ส่งอีเมลข้อมูลสำรอง (backup) ผ่าน Brevo Transactional Email API (HTTPS) ----
// เดิมใช้ Gmail SMTP ตรง ๆ ผ่าน nodemailer แต่ Render free tier บล็อกพอร์ต SMTP ขาออกทั้งหมด
// (25 / 465 / 587) ทำให้ต่อ Gmail SMTP ไม่ได้เลยไม่ว่าจะแก้ยังไง — เปลี่ยนมาส่งผ่าน HTTPS (พอร์ต 443)
// แทน ซึ่งไม่โดนบล็อกเพราะเป็นพอร์ตเดียวกับที่เว็บต้องใช้รับ request อยู่แล้ว
//
// ต้องตั้งค่า ENV บน Render:
//   BREVO_API_KEY   - สร้างที่ Brevo (brevo.com, มีแผนฟรี) > Settings > SMTP & API > API Keys
//   SMTP_USER       - อีเมลผู้ส่ง ต้องไป verify ไว้ใน Brevo ก่อน (Senders, Domains & Dedicated IPs > Senders)
//                      (ใช้ ENV ชื่อเดิมต่อเพื่อไม่ต้องแก้ค่าที่ตั้งไว้แล้วบน Render)
//   BACKUP_EMAIL_TO - อีเมลปลายทางที่จะรับไฟล์สำรอง ถ้าไม่ตั้งไว้ fallback ไปที่ SMTP_USER เอง

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendBackupEmail(attachmentBuffer: Buffer, filename: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("ยังไม่ได้ตั้งค่า BREVO_API_KEY — ไปสร้างที่ Brevo > Settings > SMTP & API > API Keys");
  }
  const senderEmail = process.env.SMTP_USER;
  if (!senderEmail) {
    throw new Error("ยังไม่ได้ตั้งค่า SMTP_USER (ใช้เป็นอีเมลผู้ส่ง ต้อง verify ไว้ใน Brevo ก่อน)");
  }
  const to = process.env.BACKUP_EMAIL_TO || senderEmail;
  const now = new Date();

  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: "ABM Backup" },
      to: [{ email: to }],
      subject: `[ABM] ข้อมูลสำรองประจำวันที่ ${now.toLocaleDateString("th-TH")}`,
      textContent:
        "ไฟล์แนบคือข้อมูลสำรองทั้งหมดของระบบ ABM (รูปแบบ JSON)\n" +
        'หากต้องกู้คืนข้อมูล ให้เข้าหน้า "ตั้งค่า" ในระบบ แล้วอัปโหลดไฟล์นี้ผ่านเมนู "กู้คืนข้อมูลจากไฟล์สำรอง"\n\n' +
        "อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ",
      attachment: [
        {
          name: filename,
          content: attachmentBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API ตอบกลับ ${res.status}: ${body.slice(0, 500)}`);
  }
}
