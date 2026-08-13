import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Customer, DocType, DocumentLine, Item } from '../../models/models';

const TYPE_OPTIONS: { value: DocType; label: string }[] = [
  { value: 'quotation', label: 'ใบเสนอราคา' },
  { value: 'invoice', label: 'ใบแจ้งหนี้' },
  { value: 'receipt', label: 'ใบเสร็จรับเงิน' },
];

@Component({
  selector: 'app-document-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-form.component.html',
})
export class DocumentFormComponent implements OnInit {
  customers: Customer[] = [];
  catalogItems: Item[] = [];
  typeOptions = TYPE_OPTIONS;

  type: DocType = 'quotation';
  customerId: number | null = null;
  vatRate = 7;
  discount = 0;
  note = '';
  lines: DocumentLine[] = [{ name: '', quantity: 1, unit: 'ชิ้น', unit_price: 0 }];

  error = '';
  saving = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.getCustomers().subscribe((c) => (this.customers = c));
    this.api.getItems().subscribe((i) => (this.catalogItems = i));
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

  get subtotal() {
    return this.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0);
  }
  get vat() {
    return ((this.subtotal - this.discount) * this.vatRate) / 100;
  }
  get total() {
    return this.subtotal - this.discount + this.vat;
  }

  submit() {
    if (!this.customerId) {
      this.error = 'กรุณาเลือกลูกค้า';
      return;
    }
    const namedLines = this.lines.filter((l) => l.name && l.name.trim());
    if (namedLines.length === 0) {
      this.error = 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ';
      return;
    }
    const invalidLine = namedLines.find(
      (l) => !(Number(l.quantity) > 0) || !(Number(l.unit_price) >= 0)
    );
    if (invalidLine) {
      this.error = `รายการ "${invalidLine.name}" ต้องระบุจำนวนมากกว่า 0 และราคาไม่ติดลบ`;
      return;
    }
    const validLines = namedLines.map((l) => ({
      ...l,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
    }));
    this.saving = true;
    this.api
      .createDocument({
        type: this.type,
        customer_id: this.customerId,
        lines: validLines,
        vat_rate: this.vatRate,
        discount: this.discount,
        note: this.note,
      })
      .subscribe({
        next: (doc) => {
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
