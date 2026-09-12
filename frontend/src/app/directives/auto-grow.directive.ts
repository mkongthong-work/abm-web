import { Directive, DoCheck, ElementRef } from '@angular/core';

/** ให้ <textarea> ขยายความสูงเองตามเนื้อหาที่พิมพ์ แทนที่จะต้องลากปรับขนาดเอง (resize handle)
 *  ใช้ ngDoCheck เทียบค่าที่อ่านจาก DOM ตรง ๆ (ไม่ใช่แค่ (input) event) เพื่อให้ครอบคลุมทั้งตอนผู้ใช้พิมพ์เอง
 *  และตอนค่าถูกตั้งจากโค้ด (เช่น โหลดเอกสารเดิมมาแก้ไข หรือเลือกจากรายการสินค้าในแคตตาล็อก) */
@Directive({
  selector: 'textarea[appAutoGrow]',
  standalone: true,
})
export class AutoGrowDirective implements DoCheck {
  private lastValue: string | null = null;

  constructor(private el: ElementRef<HTMLTextAreaElement>) {}

  ngDoCheck() {
    const textarea = this.el.nativeElement;
    if (textarea.value === this.lastValue) return;
    this.lastValue = textarea.value;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
