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

  // -- เปลี่ยนรหัส PIN: แยกฟิลด์ต่างหากจาก form หลัก เพราะต้องตรวจ PIN เดิม + ยืนยัน PIN ใหม่ตรงกันก่อนส่ง --
  currentPinInput = '';
  newPinInput = '';
  confirmPinInput = '';
  pinError = '';

  // -- ข้อมูลสำรองทั้งระบบ --
  restoring = false;
  restoreError = '';
  restoreSuccess = '';
  pendingRestoreFile: File | null = null;
  confirm: { message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null = null;

  constructor(public api: ApiService) {}

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
    this.pinError = '';

    const payload: Partial<Company> = { ...this.form };
    delete payload.has_access_pin; // อ่านอย่างเดียว ไม่ต้องส่งกลับ
    delete payload.access_pin;

    const changingPin = !!(this.currentPinInput || this.newPinInput || this.confirmPinInput);
    if (changingPin) {
      if (!this.newPinInput) {
        this.pinError = 'กรุณากรอกรหัส PIN ใหม่';
        return;
      }
      if (this.newPinInput !== this.confirmPinInput) {
        this.pinError = 'ยืนยันรหัส PIN ใหม่ไม่ตรงกัน';
        return;
      }
      if (this.form.has_access_pin && !this.currentPinInput) {
        this.pinError = 'กรุณากรอกรหัส PIN เดิม';
        return;
      }
      payload.access_pin = this.newPinInput;
      (payload as any).current_pin = this.currentPinInput;
    }

    this.saved = false;
    this.saving = true;
    this.api.updateCompany(payload).subscribe({
      next: (c) => {
        this.form = { ...c };
        this.currentPinInput = '';
        this.newPinInput = '';
        this.confirmPinInput = '';
        this.saving = false;
        this.saved = true;
        setTimeout(() => (this.saved = false), 3000);
      },
      error: (err) => {
        if (changingPin && err?.status === 400) {
          this.pinError = err?.error?.error || 'เปลี่ยนรหัส PIN ไม่สำเร็จ';
        } else {
          this.error = 'บันทึกข้อมูลไม่สำเร็จ';
        }
        this.saving = false;
      },
    });
  }

  // -- ข้อมูลสำรอง --
  onRestoreFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้ ถ้ายกเลิกแล้วเปลี่ยนใจ
    if (!file) return;

    this.restoreError = '';
    this.restoreSuccess = '';
    this.pendingRestoreFile = file;
    this.confirm = {
      message: `ยืนยันกู้คืนข้อมูลจากไฟล์ "${file.name}"? ข้อมูลปัจจุบันทั้งหมด (ลูกค้า สินค้า เอกสาร) จะถูกแทนที่ด้วยข้อมูลในไฟล์นี้ทันที และไม่สามารถย้อนกลับได้`,
      confirmLabel: 'กู้คืนข้อมูล',
      danger: true,
      onConfirm: () => this.confirmRestore(),
    };
  }

  cancelConfirm() {
    this.confirm = null;
    this.pendingRestoreFile = null;
  }

  confirmRestore() {
    const file = this.pendingRestoreFile;
    this.confirm = null;
    if (!file) return;

    this.restoring = true;
    this.restoreError = '';
    this.restoreSuccess = '';
    this.api.restoreBackup(file).subscribe({
      next: () => {
        this.restoring = false;
        this.restoreSuccess = 'กู้คืนข้อมูลเรียบร้อยแล้ว';
        this.pendingRestoreFile = null;
        setTimeout(() => (this.restoreSuccess = ''), 5000);
      },
      error: (err) => {
        this.restoring = false;
        this.restoreError = err?.error?.error || 'กู้คืนข้อมูลไม่สำเร็จ';
        this.pendingRestoreFile = null;
      },
    });
  }
}
