import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Customer } from '../../models/models';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent implements OnInit {
  customers: Customer[] = [];
  form: Partial<Customer> = { name: '', address: '', tax_id: '', phone: '', email: '' };
  loading = false;
  error = '';

  // -- edit popup --
  editing: Customer | null = null;
  editForm: Partial<Customer> = {};
  editError = '';
  saving = false;

  // -- confirm popup (ใช้ร่วมกันทั้งยืนยันบันทึกและยืนยันลบ) --
  confirm: { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getCustomers().subscribe({
      next: (data) => {
        this.customers = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'โหลดข้อมูลลูกค้าไม่สำเร็จ';
        this.loading = false;
      },
    });
  }

  submit() {
    if (!this.form.name) return;
    this.api.addCustomer(this.form).subscribe({
      next: () => {
        this.form = { name: '', address: '', tax_id: '', phone: '', email: '' };
        this.load();
      },
      error: () => (this.error = 'เพิ่มลูกค้าไม่สำเร็จ'),
    });
  }

  // -- แก้ไข --
  openEdit(c: Customer) {
    this.editing = c;
    this.editForm = { name: c.name, address: c.address, tax_id: c.tax_id, phone: c.phone, email: c.email };
    this.editError = '';
  }

  closeEdit() {
    if (this.saving) return;
    this.editing = null;
    this.editForm = {};
    this.editError = '';
  }

  requestSaveEdit() {
    if (!this.editForm.name || !this.editing) return;
    this.confirm = {
      message: `ยืนยันบันทึกการแก้ไขข้อมูลลูกค้า "${this.editForm.name}"?`,
      confirmLabel: 'บันทึกการแก้ไข',
      danger: false,
      onConfirm: () => this.saveEdit(),
    };
  }

  private saveEdit() {
    if (!this.editing) return;
    this.saving = true;
    this.api.updateCustomer(this.editing.id, this.editForm).subscribe({
      next: () => {
        this.saving = false;
        this.confirm = null;
        this.closeEdit();
        this.load();
      },
      error: () => {
        this.saving = false;
        this.confirm = null;
        this.editError = 'บันทึกการแก้ไขไม่สำเร็จ';
      },
    });
  }

  // -- ลบ --
  requestDelete(c: Customer) {
    this.confirm = {
      message: `ยืนยันลบลูกค้า "${c.name}"? การลบไม่สามารถย้อนกลับได้`,
      confirmLabel: 'ลบลูกค้า',
      danger: true,
      onConfirm: () => this.deleteConfirmed(c.id),
    };
  }

  private deleteConfirmed(id: number) {
    this.api.deleteCustomer(id).subscribe({
      next: () => {
        this.confirm = null;
        this.load();
      },
      error: () => {
        this.confirm = null;
        this.error = 'ลบลูกค้าไม่สำเร็จ';
      },
    });
  }

  cancelConfirm() {
    this.confirm = null;
  }
}
