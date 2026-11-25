import { Injectable } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast { id: number; kind: ToastKind; message: string; }

/** แจ้งเตือนมุมจอ ใช้ได้ทุกหน้า: inject ToastService แล้วเรียก toast.success('บันทึกแล้ว') / toast.error('...') */
@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts: Toast[] = [];
  private nextId = 1;

  success(message: string, ms = 2500) { this.show('success', message, ms); }
  info(message: string, ms = 3000) { this.show('info', message, ms); }
  /** error อยู่นานกว่า เผื่ออ่านไม่ทัน */
  error(message: string, ms = 5000) { this.show('error', message, ms); }

  show(kind: ToastKind, message: string, ms: number) {
    // ข้อความซ้ำที่ยังแสดงอยู่ ไม่ต้องซ้อนหลายอัน
    if (this.toasts.some((t) => t.kind === kind && t.message === message)) return;
    const t: Toast = { id: this.nextId++, kind, message };
    this.toasts.push(t);
    setTimeout(() => this.dismiss(t.id), ms);
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }
}
