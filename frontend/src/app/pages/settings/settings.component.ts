import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Company } from '../../models/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  form: Partial<Company> = {
    name: '',
    address: '',
    tax_id: '',
    phone: '',
    email: '',
    logo_path: '',
    quotation_color: '#0d9488',
    invoice_color: '#2563eb',
    receipt_color: '#7c3aed',
  };

  loading = false;
  saving = false;
  error = '';
  saved = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getCompany().subscribe({
      next: (c) => {
        this.form = { ...c };
        this.loading = false;
      },
      error: () => {
        this.error = 'โหลดข้อมูลบริษัทไม่สำเร็จ';
        this.loading = false;
      },
    });
  }

  submit() {
    if (!this.form.name || !this.form.name.trim()) {
      this.error = 'กรุณากรอกชื่อบริษัท';
      return;
    }
    this.error = '';
    this.saved = false;
    this.saving = true;
    this.api.updateCompany(this.form).subscribe({
      next: (c) => {
        this.form = { ...c };
        this.saving = false;
        this.saved = true;
        setTimeout(() => (this.saved = false), 3000);
      },
      error: () => {
        this.error = 'บันทึกข้อมูลไม่สำเร็จ';
        this.saving = false;
      },
    });
  }
}
