import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  importing = false;
  importMsg = '';

  constructor(public api: ApiService) {}

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
