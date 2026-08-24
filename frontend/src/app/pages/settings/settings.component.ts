import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Company } from '../../models/models';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

type SettingsTab = 'company' | 'colors' | 'security' | 'backup' | 'danger';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  readonly tabs: { key: SettingsTab; label: string }[] = [
    { key: 'company', label: 'ข้อมูลบริษัท' },
    { key: 'colors', label: 'สีเอกสาร' },
    { key: 'security', label: 'ความปลอดภัย' },
    { key: 'backup', label: 'ข้อมูลสำรอง' },
    { key: 'danger', label: 'โซนอันตราย' },
  ];
  activeTab: SettingsTab = 'company';

  form: Partial<Company> = {
    name: '',
    address: '',
    tax_id: '',
    phone: '',
    email: '',
    logo_path: '',
    quotation_color: '#0d9488',
    invoice_color: '#2563eb',
    receipt_color: '#7c3aed',
  };
  /** สแนปช็อตค่าที่โหลดมาล่าสุด (หรือบันทึกสำเร็จล่าสุด) — ใช้เทียบว่าแก้ไขอะไรไปบ้าง และไว้ "ยกเลิกการแก้ไข" กลับมาที่ค่านี้ */
  private original: Partial<Company> = { ...this.form };

  loading = false;
  saving = false;
  error = '';
  saved = false;

  // -- เปลี่ยนรหัส PIN: แยกฟิลด์ต่างหากจาก form หลัก เพราะต้องตรวจ PIN เดิม + ยืนยัน PIN ใหม่ตรงกันก่อนส่ง --
  currentPinInput = '';
  newPinInput = '';
  confirmPinInput = '';
  pinError = '';

  // -- ข้อมูลสำรองทั้งระบบ --
  restoring = false;
  restoreError = '';
  restoreSuccess = '';
  pendingRestoreFile: File | null = null;

  // -- โซนอันตราย: ลบเอกสาร --
  dangerUnlocked = false;
  deletingDocs = false;
  deleteDocsError = '';
  deleteDocsSuccess = '';
  confirmTypedInput = '';
  deleteFromDate = '';
  deleteToDate = '';

  /** confirmPhrase: ถ้าตั้งไว้ ต้องพิมพ์ข้อความนี้ให้ตรงก่อนถึงจะกดยืนยันได้ (กันมือลั่นสำหรับ action ที่ย้อนกลับไม่ได้) */
  confirm: { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void; confirmPhrase?: string } | null = null;

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  setTab(tab: SettingsTab) {
    this.activeTab = tab;
  }

  get showPreview(): boolean {
    return this.activeTab === 'company' || this.activeTab === 'colors';
  }

  // -- นับจำนวนฟิลด์ที่แก้ไปแล้วยังไม่บันทึก ต่อแท็บ (โชว์เป็น badge บนแท็บ + ข้อความในแถบบันทึก) --
  private readonly companyFields: (keyof Company)[] = ['name', 'address', 'tax_id', 'phone', 'email', 'logo_path'];
  private readonly colorFields: (keyof Company)[] = ['quotation_color', 'invoice_color', 'receipt_color'];

  private fieldsChangedCount(keys: (keyof Company)[]): number {
    return keys.filter((k) => ((this.form as any)[k] ?? '') !== ((this.original as any)[k] ?? '')).length;
  }

  get companyChangedCount(): number {
    return this.fieldsChangedCount(this.companyFields);
  }

  get colorsChangedCount(): number {
    return this.fieldsChangedCount(this.colorFields);
  }

  get securityChangedCount(): number {
    return this.currentPinInput || this.newPinInput || this.confirmPinInput ? 1 : 0;
  }

  tabChangedCount(tab: SettingsTab): number {
    switch (tab) {
      case 'company':
        return this.companyChangedCount;
      case 'colors':
        return this.colorsChangedCount;
      case 'security':
        return this.securityChangedCount;
      default:
        return 0;
    }
  }

  get totalChanged(): number {
    return this.companyChangedCount + this.colorsChangedCount + this.securityChangedCount;
  }

  get isDirty(): boolean {
    return this.totalChanged > 0;
  }

  get dirtyLabel(): string {
    if (this.saved) return 'บันทึกแล้ว';
    if (this.isDirty) return `แก้ไข ${this.totalChanged} รายการ ยังไม่บันทึก`;
    return 'ไม่มีการแก้ไข';
  }

  // -- แสดงวันที่แบบไทย (วัน เดือนย่อ พ.ศ. 4 หลัก) ใช้กับ access_pin_updated_at / last_backup_at --
  formatThaiDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const beYear = d.getFullYear() + 543;
    return `${day} ${month} ${beYear}`;
  }

  load() {
    this.loading = true;
    this.api.getCompany().subscribe({
      next: (c) => {
        this.form = { ...c };
        this.original = { ...c };
        this.loading = false;
      },
      error: () => {
        this.error = 'โหลดข้อมูลบริษัทไม่สำเร็จ';
        this.loading = false;
      },
    });
  }

  discard() {
    this.form = { ...this.original };
    this.currentPinInput = '';
    this.newPinInput = '';
    this.confirmPinInput = '';
    this.pinError = '';
    this.error = '';
    this.saved = false;
  }

  resetColors() {
    this.form = {
      ...this.form,
      quotation_color: this.original.quotation_color ?? '#0d9488',
      invoice_color: this.original.invoice_color ?? '#2563eb',
      receipt_color: this.original.receipt_color ?? '#7c3aed',
    };
  }

  submit() {
    if (!this.form.name || !this.form.name.trim()) {
      this.error = 'กรุณากรอกชื่อบริษัท';
      return;
    }
    this.error = '';
    this.pinError = '';

    const payload: Partial<Company> = { ...this.form };
    delete payload.has_access_pin; // อ่านอย่างเดียว ไม่ต้องส่งกลับ
    delete payload.access_pin;
    delete (payload as any).access_pin_updated_at;
    delete (payload as any).last_backup_at;

    const changingPin = !!(this.currentPinInput || this.newPinInput || this.confirmPinInput);
    if (changingPin) {
      if (!this.newPinInput) {
        this.pinError = 'กรุณากรอกรหัส PIN ใหม่';
        return;
      }
      if (this.newPinInput !== this.confirmPinInput) {
        this.pinError = 'ยืนยันรหัส PIN ใหม่ไม่ตรงกัน';
        return;
      }
      if (this.form.has_access_pin && !this.currentPinInput) {
        this.pinError = 'กรุณากรอกรหัส PIN เดิม';
        return;
      }
      payload.access_pin = this.newPinInput;
      (payload as any).current_pin = this.currentPinInput;
    }

    this.saved = false;
    this.saving = true;
    this.api.updateCompany(payload).subscribe({
      next: (c) => {
        this.form = { ...c };
        this.original = { ...c };
        this.currentPinInput = '';
        this.newPinInput = '';
        this.confirmPinInput = '';
        this.saving = false;
        this.saved = true;
        setTimeout(() => (this.saved = false), 3000);
      },
      error: (err) => {
        if (changingPin && err?.status === 400) {
          this.pinError = err?.error?.error || 'เปลี่ยนรหัส PIN ไม่สำเร็จ';
        } else {
          this.error = 'บันทึกข้อมูลไม่สำเร็จ';
        }
        this.saving = false;
      },
    });
  }

  // -- ข้อมูลสำรอง --
  onRestoreFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้ ถ้ายกเลิกแล้วเปลี่ยนใจ
    if (!file) return;

    this.restoreError = '';
    this.restoreSuccess = '';
    // เลือกไฟล์แล้วให้เลือกโหมดกู้คืนก่อน (ผสาน/แทนที่ทั้งหมด) — ไม่ใช้ modal ยืนยันแบบทั่วไป (this.confirm)
    // เพราะตรงนี้มีให้เลือก 2 ทาง ไม่ใช่แค่ยืนยัน/ยกเลิกอย่างเดียว
    this.pendingRestoreFile = file;
  }

  cancelConfirm() {
    this.confirm = null;
    this.confirmTypedInput = '';
  }

  cancelRestore() {
    this.pendingRestoreFile = null;
  }

  confirmRestore(mode: 'replace' | 'merge') {
    const file = this.pendingRestoreFile;
    this.pendingRestoreFile = null;
    if (!file) return;

    this.restoring = true;
    this.restoreError = '';
    this.restoreSuccess = '';
    this.api.restoreBackup(file, mode).subscribe({
      next: (r) => {
        this.restoring = false;
        this.restoreSuccess = mode === 'merge' ? this.mergeSummaryLabel(r) : 'กู้คืนข้อมูลเรียบร้อยแล้ว (แทนที่ข้อมูลเดิมทั้งหมด)';
        setTimeout(() => (this.restoreSuccess = ''), 8000);
      },
      error: (err) => {
        this.restoring = false;
        this.restoreError = err?.error?.error || 'กู้คืนข้อมูลไม่สำเร็จ';
      },
    });
  }

  private mergeSummaryLabel(r: any): string {
    const d = r?.restored?.documents;
    const c = r?.restored?.customers;
    const i = r?.restored?.items;
    return `ผสานข้อมูลเรียบร้อยแล้ว — เพิ่มลูกค้าใหม่ ${c?.added ?? 0} ราย, สินค้า ${i?.added ?? 0} รายการ, เอกสาร ${d?.added ?? 0} ฉบับ (รายการที่มีอยู่แล้วไม่ถูกแตะ)`;
  }

  // -- โซนอันตราย --
  toggleDangerUnlock() {
    this.dangerUnlocked = !this.dangerUnlocked;
  }

  requestDeleteAllDocuments() {
    if (!this.dangerUnlocked) return;
    this.deleteDocsError = '';
    this.deleteDocsSuccess = '';
    this.confirmTypedInput = '';
    this.confirm = {
      message:
        'ยืนยันลบเอกสารทั้งหมด (ใบเสนอราคา/ใบแจ้งหนี้/ใบเสร็จ) ทุกใบในระบบ? การกระทำนี้ย้อนกลับไม่ได้ ' +
        'หลังลบแล้วเลขที่เอกสารของเดือนนี้จะเริ่มนับ 0001 ใหม่ (ข้อมูลลูกค้าและสินค้าจะไม่ถูกลบ) ' +
        'แนะนำให้ดาวน์โหลดข้อมูลสำรองไว้ก่อนถ้ายังไม่มั่นใจ',
      confirmLabel: 'ลบเอกสารทั้งหมด',
      danger: true,
      confirmPhrase: 'ลบเอกสารทั้งหมด',
      onConfirm: () => this.confirmDeleteAllDocuments(),
    };
  }

  confirmDeleteAllDocuments() {
    this.confirm = null;
    this.confirmTypedInput = '';
    this.deletingDocs = true;
    this.deleteDocsError = '';
    this.deleteDocsSuccess = '';
    this.api.deleteDocuments().subscribe({
      next: () => {
        this.deletingDocs = false;
        this.deleteDocsSuccess = 'ลบเอกสารทั้งหมดเรียบร้อยแล้ว — เลขที่เอกสารจะเริ่มนับ 0001 ใหม่';
        setTimeout(() => (this.deleteDocsSuccess = ''), 5000);
      },
      error: (err) => {
        this.deletingDocs = false;
        this.deleteDocsError = err?.error?.error || 'ลบเอกสารไม่สำเร็จ';
      },
    });
  }

  // -- โซนอันตราย: ลบเอกสารตามช่วงวันที่ (เช็คจำนวนที่จะโดนลบก่อน แล้วค่อยให้ยืนยัน) --
  requestDeleteByRange() {
    if (!this.dangerUnlocked) return;
    if (!this.deleteFromDate && !this.deleteToDate) {
      this.deleteDocsError = 'กรุณาเลือกช่วงวันที่อย่างน้อยหนึ่งด้าน';
      return;
    }
    this.deleteDocsError = '';
    this.deleteDocsSuccess = '';
    this.api.getDocuments().subscribe({
      next: (docs) => {
        const from = this.deleteFromDate;
        const to = this.deleteToDate;
        const matched = docs.filter((d) => (!from || d.issue_date >= from) && (!to || d.issue_date <= to));
        if (matched.length === 0) {
          this.deleteDocsError = 'ไม่พบเอกสารในช่วงวันที่ที่เลือก';
          return;
        }
        this.confirmTypedInput = '';
        this.confirm = {
          message: `พบเอกสาร ${matched.length} ฉบับ ในช่วงวันที่ ${from || 'เริ่มต้น'} ถึง ${to || 'ปัจจุบัน'} ยืนยันลบทั้งหมดนี้? การกระทำนี้ย้อนกลับไม่ได้`,
          confirmLabel: `ลบ ${matched.length} รายการ`,
          danger: true,
          confirmPhrase: 'ลบ',
          onConfirm: () => this.confirmDeleteByRange(),
        };
      },
      error: () => {
        this.deleteDocsError = 'โหลดรายการเอกสารไม่สำเร็จ';
      },
    });
  }

  confirmDeleteByRange() {
    this.confirm = null;
    this.confirmTypedInput = '';
    this.deletingDocs = true;
    this.deleteDocsError = '';
    this.deleteDocsSuccess = '';
    this.api.deleteDocuments({ from: this.deleteFromDate || undefined, to: this.deleteToDate || undefined }).subscribe({
      next: (r) => {
        this.deletingDocs = false;
        this.deleteDocsSuccess = `ลบเอกสารแล้ว ${r.deleted} รายการ`;
        this.deleteFromDate = '';
        this.deleteToDate = '';
        setTimeout(() => (this.deleteDocsSuccess = ''), 5000);
      },
      error: (err) => {
        this.deletingDocs = false;
        this.deleteDocsError = err?.error?.error || 'ลบเอกสารไม่สำเร็จ';
      },
    });
  }
}
