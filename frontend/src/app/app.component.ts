import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './services/api.service';
import { LoadingService } from './services/loading.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  importing = false;
  importMsg = '';
  sidebarExpanded = false;
  mobileNavOpen = false;

  pinInput = '';
  pinError = '';
  pinLoading = false;

  constructor(
    public api: ApiService,
    public loading: LoadingService,
    public auth: AuthService
  ) {}

  submitPin() {
    if (!this.pinInput) return;
    this.pinLoading = true;
    this.pinError = '';
    this.auth.login(this.pinInput).subscribe({
      next: () => {
        this.pinLoading = false;
        this.pinInput = '';
      },
      error: () => {
        this.pinLoading = false;
        this.pinError = 'PIN ไม่ถูกต้อง';
        this.pinInput = '';
      },
    });
  }

  toggleSidebar() {
    this.sidebarExpanded = !this.sidebarExpanded;
  }

  toggleMobileNav() {
    this.mobileNavOpen = !this.mobileNavOpen;
    // บนมือถือ ลิ้นชักเมนูต้องกางเต็ม (แสดงชื่อเมนู) ไม่ใช่โหมด icon-only ของ desktop
    if (this.mobileNavOpen) this.sidebarExpanded = true;
  }

  closeMobileNav() {
    this.mobileNavOpen = false;
  }

  onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing = true;
    this.api.importExcel(file).subscribe({
      next: (res) => {
        this.importMsg = `นำเข้าสำเร็จ: ลูกค้า ${res.customers_imported} รายการ, สินค้า ${res.items_imported} รายการ`;
        this.importing = false;
        input.value = '';
      },
      error: () => {
        this.importMsg = 'นำเข้าไฟล์ไม่สำเร็จ';
        this.importing = false;
      },
    });
  }
}
