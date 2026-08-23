/**
 * แปลงจำนวนเงิน (บาท) เป็นตัวหนังสือไทย เช่น 15000.5 -> "หนึ่งหมื่นห้าพันบาทห้าสิบสตางค์"
 * พอร์ตมาจากฟังก์ชันเดียวกันใน backend/pdf-service/render.py (thai_baht_text) เพื่อให้หน้าจอ
 * (การ์ดสรุปยอด + พรีวิว) กับ PDF จริง แสดงข้อความตรงกันเสมอ — ผ่านการทดสอบกับชุดค่าอ้างอิงแล้ว
 */

const THAI_DIGITS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']; // ตำแหน่งภายในกลุ่ม 6 หลัก (0 = หลักหน่วย)

function readSixDigitGroup(groupStr: string, isLastGroup: boolean, wholeGtOne: boolean): string {
  const stripped = groupStr.replace(/^0+/, '');
  if (stripped === '') return '';
  const n = stripped.length;
  const result: string[] = [];
  for (let idx = 0; idx < n; idx++) {
    const digit = Number(stripped[idx]);
    if (digit === 0) continue;
    const pos = n - idx - 1; // 0=หน่วย, 1=สิบ, 2=ร้อย, ...
    if (pos === 0) {
      if (digit === 1 && isLastGroup && wholeGtOne) {
        result.push('เอ็ด');
      } else {
        result.push(THAI_DIGITS[digit]);
      }
    } else if (pos === 1) {
      if (digit === 1) {
        result.push('สิบ');
      } else if (digit === 2) {
        result.push('ยี่สิบ');
      } else {
        result.push(THAI_DIGITS[digit] + 'สิบ');
      }
    } else {
      result.push(THAI_DIGITS[digit] + THAI_UNITS[pos]);
    }
  }
  return result.join('');
}

function numberToThaiText(n: number): string {
  if (n === 0) return THAI_DIGITS[0];
  let s = String(n);
  const groups: string[] = [];
  while (s) {
    groups.unshift(s.slice(-6));
    s = s.slice(0, -6);
  }
  const numGroups = groups.length;
  const wholeGtOne = n > 1;
  const parts: string[] = [];
  groups.forEach((g, gi) => {
    const isLastGroup = gi === numGroups - 1;
    let text = readSixDigitGroup(g, isLastGroup, wholeGtOne);
    if (text === '') return;
    const level = numGroups - 1 - gi;
    if (level > 0) text += 'ล้าน'.repeat(level);
    parts.push(text);
  });
  return parts.join('');
}

export function thaiBahtText(amount: number): string {
  let value = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const negative = value < 0;
  value = Math.abs(Math.round((value + 1e-9) * 100) / 100);
  let baht = Math.floor(value);
  let satang = Math.round((value - baht) * 100);
  if (satang >= 100) {
    baht += 1;
    satang -= 100;
  }
  let text = numberToThaiText(baht) + 'บาท';
  text += satang === 0 ? 'ถ้วน' : numberToThaiText(satang) + 'สตางค์';
  return negative ? 'ลบ' + text : text;
}
