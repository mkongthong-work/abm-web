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

  remove(id: number) {
    if (!confirm('ลบลูกค้ารายนี้?')) return;
    this.api.deleteCustomer(id).subscribe(() => this.load());
  }
}
