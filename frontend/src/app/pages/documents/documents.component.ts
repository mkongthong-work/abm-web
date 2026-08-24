import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CreateDocumentPayload, DocumentSummary } from '../../models/models';

const TYPE_LABEL: Record<string, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  paid: 'ชำระแล้ว',
  overdue: 'เกินกำหนด',
  void: 'ยกเลิก',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-draft',
  sent: 'badge-sent',
  paid: 'badge-paid',
  overdue: 'badge-overdue',
  void: 'badge-void',
};

// ลำดับ + ป้ายกำกับของ chip กรองสถานะ (รวม "ทั้งหมด" ไว้ตัวแรก)
const STATUS_CHIP_DEFS: { key: string; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'draft', label: 'ฉบับร่าง' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'paid', label: 'ชำระแล้ว' },
  { key: 'overdue', label: 'เกินกำหนด' },
  { key: 'void', label: 'ยกเลิก' },
];

// ตัวเลือกในเมนูเปลี่ยนสถานะจากตาราง — เฉพาะสถานะจริงที่บันทึกได้ ("เกินกำหนด" คำนวณสด ไม่ใช่ค่าที่เลือกได้)
const STATUS_MENU_OPTIONS: { key: string; label: string }[] = [
  { key: 'draft', label: 'ฉบับร่าง' },
  { key: 'sent', label: 'ส่งแล้ว' },
  { key: 'paid', label: 'ชำระแล้ว' },
  { key: 'void', label: 'ยกเลิก' },
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

type SortKey = 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc' | 'number_asc';
type PeriodKey = 'all' | '30' | '90' | 'year';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './documents.component.html',
})
export class DocumentsComponent implements OnInit {
  documents: DocumentSummary[] = [];
  loading = false;
  typeLabel = TYPE_LABEL;
  statusLabel = STATUS_LABEL;
  statusBadge = STATUS_BADGE;
  statusMenuOptions = STATUS_MENU_OPTIONS;

  // -- เมนูเปลี่ยนสถานะ / เมนู ⋮ ต่อแถว (เปิดได้ทีละอันเท่านั้น) --
  openStatusMenuId: number | null = null;
  openRowMenuId: number | null = null;
  duplicating = false;
  actionError = '';

  // -- popup ยืนยัน (ใช้กับการยกเลิกเอกสาร + ลบเอกสารที่เลือก) --
  confirm: { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void; requireReason?: boolean } | null = null;
  /** เหตุผลตอนยกเลิกเอกสาร (บังคับกรอก) — เก็บไว้ดูภายในเท่านั้น ไม่พิมพ์ลง PDF */
  voidReasonInput = '';

  // -- เลือกทีละรายการ (checkbox) เพื่อลบเป็นชุด --
  selectedIds = new Set<number>();
  bulkDeleting = false;

  // -- ตัวกรอง/ค้นหา/เรียง/แบ่งหน้า (ทำฝั่ง client ทั้งหมดจากลิสต์ที่โหลดมาครั้งเดียว) --
  q = '';
  type = 'all';
  status = 'all';
  period: PeriodKey = 'all';
  sort: SortKey = 'date_desc';
  page = 1;
  pageSize = 10;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private today = new Date().toISOString().slice(0, 10);

  constructor(
    public api: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getDocuments().subscribe({
      next: (data) => {
        this.documents = data;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  pdfUrl(id: number) {
    return this.api.downloadPdfUrl(id);
  }

  /** สถานะที่ใช้แสดง/กรองจริง — "เกินกำหนด" คำนวณสด ๆ จากวันครบกำหนด ไม่ใช่ค่าที่เก็บในฐานข้อมูลตรง ๆ */
  effectiveStatus(d: DocumentSummary): string {
    if (d.status === 'sent' && d.due_date && d.due_date < this.today) return 'overdue';
    return d.status;
  }

  /** วันที่แบบไทย เช่น "18 ส.ค. 69" (withYear = false ตัดปีทิ้ง ใช้กับข้อความวันครบกำหนดสั้น ๆ ใต้วันที่) */
  formatThaiDate(dateStr: string | undefined | null, withYear = true): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    if (!withYear) return `${day} ${month}`;
    const beYear = (d.getFullYear() + 543) % 100;
    return `${day} ${month} ${String(beYear).padStart(2, '0')}`;
  }

  private daysOverdue(d: DocumentSummary): number {
    if (!d.due_date) return 0;
    const diff = new Date(this.today).getTime() - new Date(d.due_date).getTime();
    return Math.max(0, Math.round(diff / 86400000));
  }

  /** ข้อความเสริมใต้วันที่: "เกิน N วัน" (แดง) ถ้าเกินกำหนด, หรือ "ครบกำหนด D MMM" ถ้าส่งแล้วและยังไม่ครบกำหนด */
  dueNote(d: DocumentSummary): string | null {
    if (this.effectiveStatus(d) === 'overdue') return `เกิน ${this.daysOverdue(d)} วัน`;
    if (d.status === 'sent' && d.due_date) return `ครบกำหนด ${this.formatThaiDate(d.due_date, false)}`;
    return null;
  }

  private matchesQuery(d: DocumentSummary): boolean {
    const q = this.q.trim().toLowerCase();
    if (!q) return true;
    return d.doc_number.toLowerCase().includes(q) || d.customer_name.toLowerCase().includes(q);
  }

  private matchesType(d: DocumentSummary): boolean {
    return this.type === 'all' || d.doc_type === this.type;
  }

  private matchesPeriod(d: DocumentSummary): boolean {
    if (this.period === 'all') return true;
    if (this.period === 'year') {
      return new Date(d.issue_date).getFullYear() === new Date().getFullYear();
    }
    const days = (Date.now() - new Date(d.issue_date).getTime()) / 86400000;
    return days <= Number(this.period);
  }

  /** ผ่านตัวกรองทุกตัวยกเว้นสถานะ — ใช้นับจำนวนใน chip แต่ละอันแยกกัน ไม่ให้ chip ที่เลือกอยู่บังตัวเลขของ chip อื่น */
  private baseFiltered(): DocumentSummary[] {
    return this.documents.filter((d) => this.matchesQuery(d) && this.matchesType(d) && this.matchesPeriod(d));
  }

  get filtered(): DocumentSummary[] {
    const base = this.baseFiltered().filter((d) => this.status === 'all' || this.effectiveStatus(d) === this.status);
    const cmp: Record<SortKey, (a: DocumentSummary, b: DocumentSummary) => number> = {
      date_desc: (a, b) => (a.issue_date < b.issue_date ? 1 : a.issue_date > b.issue_date ? -1 : 0),
      date_asc: (a, b) => (a.issue_date > b.issue_date ? 1 : a.issue_date < b.issue_date ? -1 : 0),
      total_desc: (a, b) => b.total - a.total,
      total_asc: (a, b) => a.total - b.total,
      number_asc: (a, b) => a.doc_number.localeCompare(b.doc_number),
    };
    return base.slice().sort(cmp[this.sort]);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get currentPage(): number {
    return Math.min(this.page, this.totalPages);
  }

  get pagedRows(): DocumentSummary[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get metaLabel(): string {
    const n = this.filtered.length;
    return n === this.documents.length ? `${n} ฉบับ` : `${n} จาก ${this.documents.length} ฉบับ`;
  }

  get rangeLabel(): string {
    const total = this.filtered.length;
    if (total === 0) return 'ไม่มีรายการ';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `แสดง ${start}–${end} จาก ${total} รายการ`;
  }

  get hasFilters(): boolean {
    return !!(this.q || this.type !== 'all' || this.status !== 'all' || this.period !== 'all');
  }

  get statusChips(): { key: string; label: string; count: number }[] {
    const base = this.baseFiltered();
    return STATUS_CHIP_DEFS.map(({ key, label }) => ({
      key,
      label,
      count: key === 'all' ? base.length : base.filter((d) => this.effectiveStatus(d) === key).length,
    }));
  }

  /** เลขหน้าแบบมี ... คั่น: แสดงหน้าแรก หน้าสุดท้าย และหน้าที่ติดกับหน้าปัจจุบัน (±1) */
  get pageButtons(): (number | '…')[] {
    const total = this.totalPages;
    const page = this.currentPage;
    const nums: (number | '…')[] = [];
    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || Math.abs(p - page) <= 1) {
        nums.push(p);
      } else if (nums[nums.length - 1] !== '…') {
        nums.push('…');
      }
    }
    return nums;
  }

  // -- ตัวจัดการ event: เปลี่ยนตัวกรองใด ๆ (ยกเว้นเรียง/เปลี่ยนหน้า) ต้องรีเซ็ตกลับหน้า 1 --
  onSearchInput(value: string) {
    this.q = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
    }, 250);
  }

  setType(value: string) {
    this.type = value;
    this.page = 1;
  }

  setPeriod(value: PeriodKey) {
    this.period = value;
    this.page = 1;
  }

  setStatus(key: string) {
    this.status = key;
    this.page = 1;
  }

  setSort(value: SortKey) {
    this.sort = value; // การเรียงไม่รีเซ็ตหน้า
  }

  setPageSize(value: number) {
    this.pageSize = Number(value);
    this.page = 1;
  }

  setPage(p: number) {
    this.page = p;
  }

  prevPage() {
    if (this.currentPage > 1) this.page = this.currentPage - 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.page = this.currentPage + 1;
  }

  clearFilters() {
    this.q = '';
    this.type = 'all';
    this.status = 'all';
    this.period = 'all';
    this.page = 1;
  }

  // -- เมนูเปลี่ยนสถานะ / เมนู ⋮ ต่อแถว --
  // ใช้ position: fixed + คำนวณตำแหน่งเองจาก getBoundingClientRect() แทน position: absolute ปกติ
  // เพราะ .table-card มี overflow-y: hidden (กันตารางเลื่อนแนวตั้งซ้อนกับหน้าเว็บ) ซึ่งจะบัง dropdown
  // ของแถวใกล้ขอบล่างตารางไม่ให้เห็น — fixed หนีออกจากการ clip ของ ancestor ได้เสมอ
  statusMenuPos: { top: number; left: number } | null = null;
  rowMenuPos: { top: number; right: number } | null = null;

  toggleStatusMenu(d: DocumentSummary, event: MouseEvent) {
    event.stopPropagation();
    this.openRowMenuId = null;
    if (this.openStatusMenuId === d.id) {
      this.openStatusMenuId = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.statusMenuPos = { top: rect.bottom + 4, left: rect.left };
    this.openStatusMenuId = d.id;
  }

  toggleRowMenu(d: DocumentSummary, event: MouseEvent) {
    event.stopPropagation();
    this.openStatusMenuId = null;
    if (this.openRowMenuId === d.id) {
      this.openRowMenuId = null;
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.rowMenuPos = { top: rect.bottom + 2, right: window.innerWidth - rect.right };
    this.openRowMenuId = d.id;
  }

  /** คลิกที่อื่นในหน้า (นอกเมนู) ให้ปิดเมนูที่เปิดอยู่ทั้งหมด — ปุ่มเปิดเมนูเรียก stopPropagation ไว้แล้วจึงไม่ปิดตัวเอง */
  @HostListener('document:click')
  closeMenus() {
    this.openStatusMenuId = null;
    this.openRowMenuId = null;
  }

  /** เมนูใช้ position: fixed ที่ตำแหน่งคำนวณไว้ตอนเปิด — ถ้าเลื่อนหน้า/เลื่อนตารางระหว่างเปิดอยู่ ตำแหน่งจะไม่ตามปุ่มไป
   *  จึงปิดเมนูทิ้งไปเลยเมื่อมีการเลื่อน (ใช้ capture:true เพราะตารางเลื่อนแนวนอนเป็น scroll event ของ element ลูก ไม่ bubble ขึ้นมา) */
  @HostListener('window:scroll', ['$event'])
  onScroll() {
    if (this.openStatusMenuId !== null || this.openRowMenuId !== null) this.closeMenus();
  }

  selectStatus(d: DocumentSummary, key: string, event: MouseEvent) {
    event.stopPropagation();
    this.openStatusMenuId = null;
    if (key === d.status) return;
    if (key === 'void') {
      this.requestVoid(d);
      return;
    }
    this.applyStatus(d, key);
  }

  private applyStatus(d: DocumentSummary, key: string) {
    const prev = d.status;
    d.status = key; // อัปเดตหน้าจอทันที แล้วค่อยยืนยันกับเซิร์ฟเวอร์
    this.api.updateDocument(d.id, { status: key }).subscribe({
      error: () => {
        d.status = prev;
        this.actionError = 'เปลี่ยนสถานะไม่สำเร็จ';
      },
    });
  }

  // -- ยกเลิกเอกสาร (เปลี่ยนสถานะเป็น "ยกเลิก" เท่านั้น ไม่ลบออกจากระบบ) ต้องยืนยัน + ระบุเหตุผลก่อนเสมอ --
  // เหตุผลที่กรอกจะถูกเก็บไว้ดูภายในระบบเท่านั้น ไม่พิมพ์ลง PDF — แต่ PDF จะมีลายน้ำ "ยกเลิก" สีแดงแทน
  requestVoid(d: DocumentSummary) {
    this.openStatusMenuId = null;
    this.openRowMenuId = null;
    this.voidReasonInput = '';
    this.confirm = {
      message: `ยืนยันยกเลิกเอกสาร "${d.doc_number}"? เอกสารจะถูกเปลี่ยนสถานะเป็น "ยกเลิก" และมีลายน้ำสีแดงบน PDF`,
      confirmLabel: 'ยกเลิกเอกสาร',
      danger: true,
      requireReason: true,
      onConfirm: () => this.confirmVoid(d),
    };
  }

  requestVoidFromMenu(d: DocumentSummary, event: MouseEvent) {
    event.stopPropagation();
    this.requestVoid(d);
  }

  private confirmVoid(d: DocumentSummary) {
    const reason = this.voidReasonInput.trim();
    if (!reason) return;
    this.api.updateDocument(d.id, { status: 'void', void_reason: reason }).subscribe({
      next: () => {
        d.status = 'void';
        this.confirm = null;
        this.voidReasonInput = '';
      },
      error: (err) => {
        this.confirm = null;
        this.actionError = err?.error?.error || 'ยกเลิกเอกสารไม่สำเร็จ';
      },
    });
  }

  cancelConfirm() {
    this.confirm = null;
    this.voidReasonInput = '';
  }

  // -- ทำสำเนาเอกสาร: สร้างฉบับร่างใหม่ทันทีจากข้อมูลเดิม แล้วพาไปหน้าแก้ไข --
  duplicate(d: DocumentSummary, event: MouseEvent) {
    event.stopPropagation();
    this.openRowMenuId = null;
    if (this.duplicating) return;
    this.duplicating = true;
    this.api.getDocument(d.id).subscribe({
      next: (full) => {
        const payload: CreateDocumentPayload = {
          type: full.doc_type,
          customer_id: full.customer_id,
          lines: full.items.map((i) => ({
            name: i.name,
            description: i.description,
            quantity: i.quantity,
            unit: i.unit,
            unit_price: i.unit_price,
          })),
          vat_rate: full.vat_rate,
          discount: full.discount,
          note: full.note,
          status: 'draft',
          sign_left_label: full.sign_left_label,
          sign_right_label: full.sign_right_label,
          show_quantity: full.show_quantity,
          show_unit: full.show_unit,
          combined_receipt: full.combined_receipt,
          theme: full.theme,
        };
        this.api.createDocument(payload).subscribe({
          next: (created) => {
            this.duplicating = false;
            this.router.navigate(['/documents', created.id, 'edit']);
          },
          error: () => {
            this.duplicating = false;
            this.actionError = 'ทำสำเนาเอกสารไม่สำเร็จ';
          },
        });
      },
      error: () => {
        this.duplicating = false;
        this.actionError = 'ทำสำเนาเอกสารไม่สำเร็จ';
      },
    });
  }

  // -- เลือกทีละรายการ + ลบเป็นชุด --
  get isAllPageSelected(): boolean {
    return this.pagedRows.length > 0 && this.pagedRows.every((d) => this.selectedIds.has(d.id));
  }

  toggleSelect(id: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    for (const d of this.pagedRows) {
      if (checked) this.selectedIds.add(d.id);
      else this.selectedIds.delete(d.id);
    }
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  requestBulkDelete() {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.confirm = {
      message: `ยืนยันลบเอกสารที่เลือกไว้ ${ids.length} รายการ? การกระทำนี้ย้อนกลับไม่ได้`,
      confirmLabel: `ลบ ${ids.length} รายการ`,
      danger: true,
      onConfirm: () => this.confirmBulkDelete(ids),
    };
  }

  private confirmBulkDelete(ids: number[]) {
    this.bulkDeleting = true;
    this.api.deleteDocuments({ ids }).subscribe({
      next: () => {
        this.bulkDeleting = false;
        this.documents = this.documents.filter((d) => !ids.includes(d.id));
        this.selectedIds.clear();
        this.confirm = null;
      },
      error: () => {
        this.bulkDeleting = false;
        this.confirm = null;
        this.actionError = 'ลบเอกสารที่เลือกไม่สำเร็จ';
      },
    });
  }
}
