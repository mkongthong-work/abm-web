import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Company, Customer, DocType, DocumentDetail } from '../../models/models';
import { thaiBahtText } from '../../utils/thai-baht-text';

const TYPE_LABEL: Record<DocType, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

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

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** หน้ารายละเอียดเอกสารแบบดูอย่างเดียว — แยกต่างหากจากฟอร์มแก้ไข ไม่มีช่องกรอกใด ๆ เลย
 *  กดจากแถวในตารางเอกสาร (documents.component) มาที่นี่ ส่วนปุ่ม "แก้ไข" ในหน้านี้ไปที่ document-form ต่อ */
@Component({
  selector: 'app-document-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './document-detail.component.html',
})
export class DocumentDetailComponent implements OnInit {
  typeLabel = TYPE_LABEL;
  statusLabel = STATUS_LABEL;
  statusBadge = STATUS_BADGE;

  id: number | null = null;
  doc: DocumentDetail | null = null;
  customers: Customer[] = [];
  company: Company | null = null;
  loading = true;
  error = '';

  constructor(
    public api: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.id = idParam ? Number(idParam) : null;
    if (!this.id) {
      this.error = 'ไม่พบเอกสาร';
      this.loading = false;
      return;
    }
    this.api.getCustomers().subscribe((c) => (this.customers = c));
    this.api.getCompany().subscribe({
      next: (c) => (this.company = c),
      error: () => (this.company = null),
    });
    this.api.getDocument(this.id).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.loading = false;
      },
      error: () => {
        this.error = 'โหลดเอกสารไม่สำเร็จ';
        this.loading = false;
      },
    });
  }

  get selectedCustomer(): Customer | null {
    if (!this.doc) return null;
    return this.customers.find((c) => c.id === this.doc!.customer_id) || null;
  }

  /** สีประจำเอกสาร: ธีม "มินิมอล" บังคับเป็นสีดำ เหมือนพฤติกรรมจริงตอนพิมพ์ PDF */
  get accentColor(): string {
    if (!this.doc) return '#0d9488';
    if (this.doc.theme === 'minimal') return '#1a1a1a';
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
    return fromCompany[this.doc.doc_type] || fallback[this.doc.doc_type];
  }

  get previewDocLabel(): string {
    if (!this.doc) return '';
    if (this.doc.doc_type === 'invoice' && this.doc.combined_receipt) return 'ใบแจ้งหนี้ / ใบเสร็จรับเงิน';
    return this.typeLabel[this.doc.doc_type];
  }

  get totalInWords(): string {
    return this.doc ? thaiBahtText(this.doc.total) : '';
  }

  effectiveQty(l: { quantity: number }): number {
    return this.doc?.show_quantity ? l.quantity || 0 : 1;
  }

  formatThaiDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate();
    const month = THAI_MONTHS_SHORT[d.getMonth()];
    const beYear = (d.getFullYear() + 543) % 100;
    return `${day} ${month} ${String(beYear).padStart(2, '0')}`;
  }

  goBack() {
    this.router.navigate(['/documents']);
  }
}
