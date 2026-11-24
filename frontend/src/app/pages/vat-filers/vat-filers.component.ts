import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Customer, VatFiler } from '../../models/models';
import { copyText, currentMonth, formatMonthShortTh } from '../../utils/vat-month';

@Component({
  selector: 'app-vat-filers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vat-filers.component.html',
})
export class VatFilersComponent implements OnInit {
  readonly thisMonth = currentMonth();
  filers: VatFiler[] = [];
  customers: Customer[] = [];
  loading = false;
  error = '';

  adding = false;
  search = '';
  startMonth = this.thisMonth;
  copiedId: number | null = null;

  confirm: { message: string; confirmLabel: string; onConfirm: () => void } | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
    this.api.getCustomers().subscribe((c) => (this.customers = c));
  }

  load() {
    this.loading = true;
    this.api.getVatFilers().subscribe({
      next: (d) => { this.filers = d; this.loading = false; },
      error: () => { this.error = 'โหลดข้อมูลไม่สำเร็จ'; this.loading = false; },
    });
  }

  get activeCount() { return this.filers.filter((f) => !f.end_month).length; }

  /** ลูกค้าที่ยังไม่อยู่ในรายการ (ช่วงที่ยังเปิดอยู่) และตรงกับคำค้น */
  get candidates(): Customer[] {
    const active = new Set(this.filers.filter((f) => !f.end_month).map((f) => f.customer_id));
    const q = this.search.trim().toLowerCase();
    return this.customers.filter(
      (c) => !active.has(c.id) && (!q || c.name.toLowerCase().includes(q) || (c.tax_id || '').includes(q))
    );
  }

  period(f: VatFiler): string {
    const s = formatMonthShortTh(f.start_month);
    return f.end_month ? `${s} – ${formatMonthShortTh(f.end_month)}` : `${s} – ปัจจุบัน`;
  }

  openAdd() {
    this.adding = true;
    this.search = '';
    this.startMonth = this.thisMonth;
    this.error = '';
  }

  add(c: Customer) {
    this.api.addVatFiler(c.id, this.startMonth).subscribe({
      next: () => { this.adding = false; this.load(); },
      error: (e) => (this.error = e?.error?.error || 'เพิ่มไม่สำเร็จ'),
    });
  }

  requestStop(f: VatFiler) {
    this.confirm = {
      message: `หยุดยื่น ภ.พ.30 ให้ "${f.name}" ตั้งแต่เดือนหน้า? เดือน${formatMonthShortTh(this.thisMonth)}และเดือนก่อนหน้ายังแสดงในประวัติตามเดิม`,
      confirmLabel: 'หยุดยื่น',
      onConfirm: () => {
        this.api.stopVatFiler(f.id, this.thisMonth).subscribe({
          next: () => { this.confirm = null; this.load(); },
          error: () => { this.confirm = null; this.error = 'บันทึกไม่สำเร็จ'; },
        });
      },
    };
  }

  async copyTax(f: VatFiler) {
    if (!f.tax_id) return;
    if (await copyText(f.tax_id)) {
      this.copiedId = f.id;
      setTimeout(() => { if (this.copiedId === f.id) this.copiedId = null; }, 1500);
    }
  }
}
