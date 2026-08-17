import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Company, Customer, CreateDocumentPayload, DocType, DocumentLine, Item } from '../../models/models';

const TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'quotation', label: 'ใบเสนอราคา' },
  { value: 'invoice', label: 'ใบแจ้งหนี้' },
  { value: 'receipt', label: 'ใบเสร็จรับเงิน' },
];

const TYPE_LABEL: Record<DocType, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'sent', label: 'ส่งแล้ว' },
  { value: 'paid', label: 'ชำระแล้ว' },
  { value: 'void', label: 'ยกเลิก' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  paid: 'ชำระแล้ว',
  void: 'ยกเลิก',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-draft',
  sent: 'badge-sent',
  paid: 'badge-paid',
  void: 'badge-void',
};

@Component({
  selector: 'app-document-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-form.component.html',
})
export class DocumentFormComponent implements OnInit {
  customers: Customer[] = [];
  catalogItems: Item[] = [];
  company: Company | null = null;
  typeOptions = TYPE_OPTIONS;
  typeLabel = TYPE_LABEL;
  statusOptions = STATUS_OPTIONS;
  statusLabel = STATUS_LABEL;
  statusBadge = STATUS_BADGE;
  today = new Date();

  editId: number | null = null;
  editDocNumber = '';
  originalType: DocType = 'quotation';
  originalIssueDate = '';
  loadingDoc = false;

  type: DocType = 'quotation';
  customerId: number | null = null;
  vatRate = 7;
  discount = 0;
  note = '';
  lines: DocumentLine[] = [{ name: '', quantity: 1, unit: 'ชิ้น', unit_price: 0 }];

  issueDate = new Date().toISOString().slice(0, 10);
  dueDate = this.defaultDueDate();
  status = 'draft';

  signLeftLabel = 'ผู้เสนอราคา / ผู้ออกเอกสาร';
  signRightLabel = 'ผู้อนุมัติ / ผู้รับเอกสาร';

  // ตัว toggle เปิด/ปิดฟิลด์ที่ไม่จำเป็นต้องใช้ทุกครั้ง
  vatEnabled = true;
  discountEnabled = true;
  noteEnabled = false;
  dueDateEnabled = false;
  signLeftEnabled = true;
  signRightEnabled = true;
  showUnit = false;
  showQuantity = false;

  // ระดับการซูมของแผงตัวอย่างเอกสาร
  zoom = 100;

  error = '';
  saving = false;
  previewing = false;

  get isEdit(): boolean {
    return this.editId !== null;
  }

  constructor(
    public api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  private defaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  ngOnInit() {
    this.api.getCustomers().subscribe((c) => (this.customers = c));
    this.api.getItems().subscribe((i) => (this.catalogItems = i));
    this.api.getCompany().subscribe({
      next: (c) => (this.company = c),
      error: () => (this.company = null),
    });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.editId = Number(idParam);
      this.loadDocument(this.editId);
    }
  }

  loadDocument(id: number) {
    this.loadingDoc = true;
    this.api.getDocument(id).subscribe({
      next: (doc) => {
        this.type = doc.doc_type;
        this.originalType = doc.doc_type;
        this.editDocNumber = doc.doc_number;
        this.customerId = doc.customer_id;
        this.vatRate = doc.vat_rate;
        this.discount = doc.discount;
        this.note = doc.note || '';
        this.issueDate = doc.issue_date || this.issueDate;
        this.originalIssueDate = doc.issue_date || this.issueDate;
        this.status = doc.status || 'draft';
        this.lines = doc.items.length
          ? doc.items.map((it) => ({ ...it }))
          : [{ name: '', quantity: 1, unit: 'ชิ้น', unit_price: 0 }];
        // ตั้ง toggle ตามข้อมูลเดิม: ถ้ามีค่า/ข้อความอยู่แล้วให้เปิดไว้ให้เห็นทันที
        this.vatEnabled = Number(doc.vat_rate) > 0;
        this.discountEnabled = Number(doc.discount) > 0;
        this.noteEnabled = !!doc.note;
        this.dueDateEnabled = !!doc.due_date;
        this.dueDate = doc.due_date || this.dueDate;
        this.signLeftEnabled = doc.sign_left_label !== '';
        this.signRightEnabled = doc.sign_right_label !== '';
        if (doc.sign_left_label) this.signLeftLabel = doc.sign_left_label;
        if (doc.sign_right_label) this.signRightLabel = doc.sign_right_label;
        // ใช้ค่า toggle ที่บันทึกไว้ของเอกสารนี้เป็นหลัก ถ้าไม่มี (เอกสารเก่าก่อนมีฟีเจอร์นี้) ค่อย
        // เดาจากข้อมูลจริง: ถ้ามีจำนวน ≠ 1 หรือหน่วยไม่ใช่ "ชิ้น" อยู่แล้วให้เปิดคอลัมน์นั้นให้เห็นทันที
        // กันข้อมูลเดิมถูกบันทึกทับด้วยค่าเริ่มต้นโดยไม่ตั้งใจ
        this.showQuantity =
          doc.show_quantity !== undefined && doc.show_quantity !== null
            ? doc.show_quantity
            : this.lines.some((l) => Number(l.quantity) !== 1);
        this.showUnit =
          doc.show_unit !== undefined && doc.show_unit !== null
            ? doc.show_unit
            : this.lines.some((l) => l.unit && l.unit !== 'ชิ้น');
        this.loadingDoc = false;
      },
      error: () => {
        this.error = 'โหลดเอกสารไม่สำเร็จ';
        this.loadingDoc = false;
      },
    });
  }

  onToggleVat(enabled: boolean) {
    this.vatEnabled = enabled;
    if (!enabled) this.vatRate = 0;
    else if (!this.vatRate) this.vatRate = 7;
  }

  onToggleDiscount(enabled: boolean) {
    this.discountEnabled = enabled;
    if (!enabled) this.discount = 0;
  }

  onToggleNote(enabled: boolean) {
    this.noteEnabled = enabled;
    if (!enabled) this.note = '';
  }

  onToggleDueDate(enabled: boolean) {
    this.dueDateEnabled = enabled;
    if (enabled && !this.dueDate) this.dueDate = this.defaultDueDate();
  }

  onToggleSignLeft(enabled: boolean) {
    this.signLeftEnabled = enabled;
  }

  onToggleSignRight(enabled: boolean) {
    this.signRightEnabled = enabled;
  }

  addLine() {
    this.lines.push({ name: '', quantity: 1, unit: 'ชิ้น', unit_price: 0 });
  }

  removeLine(idx: number) {
    this.lines.splice(idx, 1);
  }

  fillFromCatalog(idx: number, itemId: string) {
    const item = this.catalogItems.find((i) => i.id === Number(itemId));
    if (!item) return;
    this.lines[idx] = {
      name: item.name,
      description: item.description,
      quantity: this.lines[idx].quantity || 1,
      unit: item.unit,
      unit_price: item.unit_price,
    };
  }

  /** ผูกกับช่อง input+datalist "ชื่อรายการ": ถ้าพิมพ์ตรงกับชื่อในแคตตาล็อกให้ดึงหน่วย/ราคามาเติมให้อัตโนมัติ */
  onNameInput(idx: number, name: string) {
    this.lines[idx].name = name;
    const item = this.catalogItems.find((i) => i.name === name);
    if (item) {
      this.lines[idx].unit = item.unit;
      this.lines[idx].unit_price = item.unit_price;
      this.lines[idx].description = item.description;
    }
  }

  /** กด Enter ที่ช่องสุดท้ายของแถวสุดท้าย เพื่อเพิ่มแถวใหม่เร็ว ๆ */
  onLineKeydown(event: KeyboardEvent, idx: number) {
    if (event.key === 'Enter' && idx === this.lines.length - 1) {
      event.preventDefault();
      this.addLine();
    }
  }

  get selectedCustomer(): Customer | null {
    return this.customers.find((c) => c.id === this.customerId) || null;
  }

  /** รายการที่มีชื่อแล้ว ใช้แสดงในพรีวิว (ไม่รวมแถวว่างที่ยังกรอกไม่เสร็จ) */
  get previewLines(): DocumentLine[] {
    return this.lines.filter((l) => l.name && l.name.trim());
  }

  private docPrefix(): string {
    return this.type === 'quotation' ? 'QT' : this.type === 'invoice' ? 'INV' : 'RC';
  }

  /** สีประจำเอกสาร ตามประเภทที่เลือก มาจากหน้าตั้งค่าบริษัท (มีสีเริ่มต้นเผื่อยังไม่ได้ตั้งค่า) */
  get accentColor(): string {
    const fallback: Record<DocType, string> = {
      quotation: '#0d9488',
      invoice: '#2563eb',
      receipt: '#7c3aed',
    };
    const fromCompany: Record<DocType, string | undefined> = {
      quotation: this.company?.quotation_color,
      invoice: this.company?.invoice_color,
      receipt: this.company?.receipt_color,
    };
    return fromCompany[this.type] || fallback[this.type];
  }

  /** เดือนของ "วันที่ออกเอกสาร" เปลี่ยนไปจากเดิมหรือไม่ (เลขที่เอกสารรันตามเดือนนี้) */
  private sameIssueMonth(): boolean {
    return this.issueDate.slice(0, 7) === this.originalIssueDate.slice(0, 7);
  }

  get willRenumber(): boolean {
    return this.isEdit && (this.type !== this.originalType || !this.sameIssueMonth());
  }

  get docNumberDisplay(): string {
    if (this.isEdit && !this.willRenumber) return this.editDocNumber;
    // เอกสารใหม่ หรือกำลังจะออกเลขที่ใหม่ (เปลี่ยนประเภท/ย้ายเดือน) — โชว์เลขที่ตัวอย่างตาม "วันที่ออกเอกสาร" ที่เลือกอยู่
    const d = new Date(this.issueDate || new Date().toISOString().slice(0, 10));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${this.docPrefix()}-${y}-${m}-ตัวอย่าง`;
  }

  /** ยังบันทึกไม่ได้เมื่อใด และเพราะอะไร ใช้แสดงทั้งในแบนเนอร์เตือนและปุ่มบันทึก */
  get validationMessage(): string {
    if (!this.customerId && this.previewLines.length === 0) {
      return 'ต้องเลือกลูกค้า และเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
    }
    if (!this.customerId) return 'ต้องเลือกลูกค้าก่อนบันทึกเอกสาร';
    if (this.previewLines.length === 0) return 'ต้องเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
    return '';
  }

  get canSave(): boolean {
    return !this.validationMessage;
  }

  zoomIn() {
    this.zoom = Math.min(150, this.zoom + 10);
  }
  zoomOut() {
    this.zoom = Math.max(50, this.zoom - 10);
  }

  cancel() {
    this.router.navigate(['/documents']);
  }

  /** จำนวนที่ใช้คิดเงินจริงของแต่ละบรรทัด — ถ้าซ่อนคอลัมน์จำนวน จะบังคับเป็น 1 เสมอ (ตรงกับตอนบันทึกจริง) */
  effectiveQty(l: DocumentLine): number {
    return this.showQuantity ? l.quantity || 0 : 1;
  }

  get subtotal() {
    return this.lines.reduce((s, l) => s + this.effectiveQty(l) * (l.unit_price || 0), 0);
  }
  get vat() {
    return ((this.subtotal - this.discount) * this.vatRate) / 100;
  }
  get total() {
    return this.subtotal - this.discount + this.vat;
  }

  /** ตรวจสอบข้อมูลในฟอร์มและประกอบเป็น payload เดียวใช้ทั้งตอน preview / บันทึกจริง */
  private buildPayload(): CreateDocumentPayload | null {
    if (!this.customerId) {
      this.error = 'กรุณาเลือกลูกค้า';
      return null;
    }
    const namedLines = this.lines.filter((l) => l.name && l.name.trim());
    if (namedLines.length === 0) {
      this.error = 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
      return null;
    }
    const invalidLine = namedLines.find(
      (l) => (this.showQuantity && !(Number(l.quantity) > 0)) || !(Number(l.unit_price) >= 0)
    );
    if (invalidLine) {
      this.error = `รายการ "${invalidLine.name}" ต้องระบุจำนวนมากกว่า 0 และราคาไม่ติดลบ`;
      return null;
    }
    const validLines = namedLines.map((l) => ({
      ...l,
      quantity: this.showQuantity ? Number(l.quantity) : 1,
      unit_price: Number(l.unit_price),
      unit: this.showUnit ? l.unit : 'ชิ้น',
    }));
    this.error = '';
    return {
      type: this.type,
      customer_id: this.customerId,
      lines: validLines,
      vat_rate: this.vatEnabled ? Number(this.vatRate) || 0 : 0,
      discount: this.discountEnabled ? Number(this.discount) || 0 : 0,
      note: this.noteEnabled ? this.note : '',
      issue_date: this.issueDate,
      due_date: this.dueDateEnabled ? this.dueDate : '',
      status: this.status,
      sign_left_label: this.signLeftEnabled ? this.signLeftLabel : '',
      sign_right_label: this.signRightEnabled ? this.signRightLabel : '',
      show_quantity: this.showQuantity,
      show_unit: this.showUnit,
    };
  }

  preview() {
    const payload = this.buildPayload();
    if (!payload) return;
    this.previewing = true;
    this.api.previewDocumentPdf(payload).subscribe({
      next: (blob) => {
        this.previewing = false;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        this.previewing = false;
        this.error = 'สร้างตัวอย่าง PDF ไม่สำเร็จ';
      },
    });
  }

  submit() {
    const payload = this.buildPayload();
    if (!payload) return;
    this.saving = true;

    if (this.isEdit) {
      this.api
        .updateDocument(this.editId!, {
          type: payload.type,
          customer_id: payload.customer_id,
          lines: payload.lines,
          vat_rate: payload.vat_rate,
          discount: payload.discount,
          note: payload.note,
          issue_date: payload.issue_date,
          due_date: payload.due_date,
          status: payload.status,
          sign_left_label: payload.sign_left_label,
          sign_right_label: payload.sign_right_label,
          show_quantity: payload.show_quantity,
          show_unit: payload.show_unit,
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.router.navigate(['/documents']);
          },
          error: () => {
            this.saving = false;
            this.error = 'บันทึกการแก้ไขไม่สำเร็จ';
          },
        });
    } else {
      this.api.createDocument(payload).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/documents']);
        },
        error: () => {
          this.saving = false;
          this.error = 'สร้างเอกสารไม่สำเร็จ';
        },
      });
    }
  }
}
