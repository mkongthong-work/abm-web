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

  remove(id: number) {
    if (!confirm('ลบรายการนี้?')) return;
    this.api.deleteItem(id).subscribe(() => this.load());
  }
}
