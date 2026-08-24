export interface Company {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  logo_path?: string;
  quotation_color?: string;
  invoice_color?: string;
  receipt_color?: string;
  /** ส่งได้เฉพาะตอนบันทึก (ตั้ง/เปลี่ยน PIN ใหม่) — เซิร์ฟเวอร์จะไม่ส่งค่าจริงกลับมาให้ ดูสถานะจาก has_access_pin แทน */
  access_pin?: string;
  /** ต้องส่งคู่กับ access_pin เสมอตอนเปลี่ยน PIN (ยกเว้นตั้งครั้งแรกที่ยังไม่เคยมี PIN) — เซิร์ฟเวอร์ใช้ตรวจว่าเป็นเจ้าของ PIN เดิมจริง */
  current_pin?: string;
  /** อ่านอย่างเดียว: ตั้ง PIN ไว้แล้วหรือยัง (ไม่บอกค่าจริง) */
  has_access_pin?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
}

export interface Item {
  id: number;
  name: string;
  description?: string;
  unit: string;
  unit_price: number;
}

export type DocType = 'quotation' | 'invoice' | 'receipt';
export type DocTheme = 'modern' | 'minimal';

export interface DocumentSummary {
  id: number;
  doc_type: DocType;
  doc_number: string;
  customer_name: string;
  issue_date: string;
  due_date?: string;
  status: string;
  total: number;
}

export interface DocumentLine {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface CreateDocumentPayload {
  type: DocType;
  customer_id: number;
  lines: DocumentLine[];
  vat_rate?: number;
  discount?: number;
  note?: string;
  issue_date?: string;
  due_date?: string;
  status?: string;
  sign_left_label?: string;
  sign_right_label?: string;
  show_quantity?: boolean;
  show_unit?: boolean;
  show_price?: boolean;
  combined_receipt?: boolean;
  theme?: DocTheme;
  /** ระบุเองได้เฉพาะตอนสร้างเอกสารใหม่ — ใช้กรณีแทรกเลขที่เอกสารย้อนหลัง (เช่น "QT-2026-08-0001-1") ไม่ระบุ = ให้ระบบออกเลขอัตโนมัติ */
  doc_number?: string;
}

/** ผลเช็คว่าวันที่ออกเอกสารที่เลือก ย้อนหลังกว่าเอกสารล่าสุดของประเภท/เดือนเดียวกันหรือไม่ */
export interface DocNumberCheck {
  next_number: string;
  conflict: boolean;
  latest_number: string | null;
  latest_issue_date: string | null;
  suggested_number: string | null;
}

export interface UpdateDocumentPayload {
  type?: DocType;
  customer_id?: number;
  lines?: DocumentLine[];
  vat_rate?: number;
  discount?: number;
  note?: string;
  status?: string;
  issue_date?: string;
  due_date?: string;
  sign_left_label?: string;
  sign_right_label?: string;
  show_quantity?: boolean;
  show_unit?: boolean;
  show_price?: boolean;
  combined_receipt?: boolean;
  theme?: DocTheme;
}

/** ค่าเริ่มต้นของ "ตัวเลือกเอกสาร" ที่จำไว้ต่อประเภทเอกสาร (ใช้ตอนสร้างเอกสารใหม่เท่านั้น) */
export interface DocumentDefaults {
  vat_enabled: boolean;
  vat_rate: number;
  discount_enabled: boolean;
  note_enabled: boolean;
  combined_receipt: boolean;
}

export interface DocumentDetail {
  id: number;
  doc_type: DocType;
  doc_number: string;
  customer_id: number;
  issue_date: string;
  due_date?: string;
  vat_rate: number;
  discount: number;
  note?: string;
  status: string;
  sign_left_label?: string;
  sign_right_label?: string;
  show_quantity?: boolean;
  show_unit?: boolean;
  show_price?: boolean;
  combined_receipt?: boolean;
  theme?: DocTheme;
  items: DocumentLine[];
  subtotal: number;
  vat: number;
  total: number;
}
