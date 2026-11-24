export const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

/** เดือนปัจจุบันตามเวลาไทย รูปแบบ YYYY-MM */
export function currentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' })
    .format(new Date()).slice(0, 7);
}

/** วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthTh(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${TH_MONTHS[mo - 1]} ${y + 543}`;
}

export function formatMonthShortTh(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${TH_SHORT[mo - 1]} ${y + 543}`;
}

export function formatDateTh(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  return `${d} ${TH_SHORT[mo - 1]} ${y + 543}`;
}

/** ครบกำหนดยื่น ภ.พ.30 = วันที่ 15 ของเดือนถัดไป */
export function deadlineOf(m: string): string {
  return `${shiftMonth(m, 1)}-15`;
}

/** จำนวนวันจาก today ถึง dateISO (ลบ = เลยกำหนดแล้ว) */
export function daysUntil(dateISO: string, today: string): number {
  const a = Date.parse(dateISO + 'T00:00:00Z');
  const b = Date.parse(today + 'T00:00:00Z');
  return Math.round((a - b) / 86400000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}
