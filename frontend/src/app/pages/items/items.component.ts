import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Item } from '../../models/models';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './items.component.html',
})
export class ItemsComponent implements OnInit {
  items: Item[] = [];
  form: Partial<Item> = { name: '', unit: 'ชิ้น', unit_price: 0, description: '' };
  loading = false;
  error = '';

  // -- แก้ไข --
  editing: Item | null = null;
  editForm: Partial<Item> = {};
  editError = '';
  saving = false;

  // -- ยืนยัน (ใช้ร่วมกันทั้งบันทึกแก้ไขและลบ) --
  confirm: { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getItems().subscribe({
      next: (data) => {
        this.items = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'โหลดข้อมูลสินค้าไม่สำเร็จ';
        this.loading = false;
      },
    });
  }

  submit() {
    if (!this.form.name || this.form.unit_price === undefined) return;
    this.api.addItem(this.form).subscribe({
      next: () => {
        this.form = { name: '', unit: 'ชิ้น', unit_price: 0, description: '' };
        this.load();
      },
      error: () => (this.error = 'เพิ่มสินค้าไม่สำเร็จ'),
    });
  }

  // -- แก้ไข --
  openEdit(i: Item) {
    this.editing = i;
    this.editForm = { name: i.name, description: i.description, unit: i.unit, unit_price: i.unit_price };
    this.editError = '';
  }

  closeEdit() {
    if (this.saving) return;
    this.editing = null;
    this.editForm = {};
    this.editError = '';
  }

  requestSaveEdit() {
    if (!this.editForm.name || this.editForm.unit_price === undefined || !this.editing) return;
    this.confirm = {
      message: `ยืนยันบันทึกการแก้ไขรายการ "${this.editForm.name}"?`,
      confirmLabel: 'บันทึกการแก้ไข',
      danger: false,
      onConfirm: () => this.saveEdit(),
    };
  }

  private saveEdit() {
    if (!this.editing) return;
    this.saving = true;
    this.api.updateItem(this.editing.id, this.editForm).subscribe({
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
  requestDelete(i: Item) {
    this.confirm = {
      message: `ยืนยันลบรายการ "${i.name}"? การลบไม่สามารถย้อนกลับได้`,
      confirmLabel: 'ลบรายการ',
      danger: true,
      onConfirm: () => this.deleteConfirmed(i.id),
    };
  }

  private deleteConfirmed(id: number) {
    this.api.deleteItem(id).subscribe({
      next: () => {
        this.confirm = null;
        this.load();
      },
      error: () => {
        this.confirm = null;
        this.error = 'ลบรายการไม่สำเร็จ';
      },
    });
  }

  cancelConfirm() {
    this.confirm = null;
  }
}
