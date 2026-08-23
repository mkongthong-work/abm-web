import { Injectable, signal } from '@angular/core';

/**
 * ตัวติดตามสถานะ "กำลังโหลด" ระดับทั้งแอป — ผูกกับ loadingInterceptor ที่นับจำนวน
 * HTTP request ที่ยังค้างอยู่ (active count) แล้วเปิด/ปิด overlay กลางหน้าอัตโนมัติ
 * ทุกครั้งที่มีการเรียก API ไม่ต้องเปิด/ปิดเองทีละหน้า
 *
 * กติกาแสดงผล (ตามสเปกไอคอนที่ได้รับมา):
 * - รอเกิน 400ms ค่อยแสดง overlay (กัน flicker ตอน request เร็ว)
 * - พอ request สุดท้ายเสร็จ ปิดทันที
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private activeRequests = 0;
  private showTimer: ReturnType<typeof setTimeout> | null = null;

  visible = signal(false);

  start() {
    this.activeRequests++;
    if (this.activeRequests === 1 && !this.showTimer) {
      this.showTimer = setTimeout(() => {
        if (this.activeRequests > 0) this.visible.set(true);
        this.showTimer = null;
      }, 400);
    }
  }

  stop() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      if (this.showTimer) {
        clearTimeout(this.showTimer);
        this.showTimer = null;
      }
      this.visible.set(false);
    }
  }
}
