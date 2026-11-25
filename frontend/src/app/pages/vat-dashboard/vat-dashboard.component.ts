import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { VatDashboardRow } from '../../models/models';
import {
  copyText, currentMonth, daysUntil, deadlineOf, formatDateTh, formatMonthTh, shiftMonth, todayISO,
} from '../../utils/vat-month';

type StatusFilter = 'all' | 'todo' | 'done';

@Component({
  selector: 'app-vat-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vat-dashboard.component.html',
})
export class VatDashboardComponent implements OnInit {
  readonly thisMonth = currentMonth();
  month = this.thisMonth;
  rows: VatDashboardRow[] = [];
  filter: StatusFilter = 'all';
  loading = false;
  error = '';
  copiedId: number | null = null;

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
  }

  get monthLabel() { return formatMonthTh(this.month); }
  get total() { return this.rows.length; }
  get done() { return this.rows.filter((r) => r.filed_at).length; }
  get todo() { return this.total - this.done; }
  get percent() { return this.total ? Math.round((this.done * 100) / this.total) : 0; }
  get visible() {
    return this.rows.filter((r) => this.filter === 'all' || (this.filter === 'done' ? !!r.filed_at : !r.filed_at));
  }

  get deadlineText(): string {
    const dl = deadlineOf(this.month);
    const days = daysUntil(dl, todayISO());
    const when = formatDateTh(dl);
    if (this.todo === 0 && this.total > 0) return `ครบกำหนดยื่นภายใน ${when}`;
    if (days < 0) return `ครบกำหนดยื่นภายใน ${when} (เลยกำหนดมา ${-days} วัน)`;
    if (days === 0) return `ครบกำหนดยื่นภายใน ${when} (วันนี้เป็นวันสุดท้าย)`;
    return `ครบกำหนดยื่นภายใน ${when} (อีก ${days} วัน)`;
  }
  get overdue(): boolean {
    return this.todo > 0 && daysUntil(deadlineOf(this.month), todayISO()) < 0;
  }

  shift(delta: number) {
    this.month = shiftMonth(this.month, delta);
    this.load();
  }
  goThisMonth() {
    this.month = this.thisMonth;
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getVatDashboard(this.month).subscribe({
      next: (d) => { this.rows = d; this.loading = false; },
      error: () => { this.toast.error('โหลดข้อมูลไม่สำเร็จ'); this.loading = false; },
    });
  }

  toggle(r: VatDashboardRow, checked: boolean) {
    const prev = r.filed_at;
    r.filed_at = checked ? todayISO() : null;
    this.api.setVatFiling(r.customer_id, this.month, checked, r.filed_at ?? undefined).subscribe({
      next: () => this.toast.success(checked ? 'บันทึกว่ายื่นแล้ว' : 'ยกเลิกการติ๊กแล้ว'),
      error: () => { r.filed_at = prev; this.toast.error('บันทึกไม่สำเร็จ (เซิร์ฟเวอร์อาจกำลังตื่น) ลองติ๊กอีกครั้ง'); },
    });
  }

  changeDate(r: VatDashboardRow, value: string) {
    if (!value || !r.filed_at) return;
    const prev = r.filed_at;
    r.filed_at = value;
    this.api.setVatFiling(r.customer_id, this.month, true, value).subscribe({
      next: () => this.toast.success('แก้วันที่ยื่นแล้ว'),
      error: () => { r.filed_at = prev; this.toast.error('บันทึกวันที่ไม่สำเร็จ'); },
    });
  }

  async copyTax(r: VatDashboardRow) {
    if (!r.tax_id) return;
    if (await copyText(r.tax_id)) {
      this.copiedId = r.customer_id;
      setTimeout(() => { if (this.copiedId === r.customer_id) this.copiedId = null; }, 1500);
    }
  }
}
