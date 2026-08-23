import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

/** ครอบทุก HTTP request ของแอปอัตโนมัติ เพื่อเปิด/ปิด overlay "กำลังโหลด" กลางหน้า
 *  โดยไม่ต้องเขียนโค้ดเปิด-ปิดเองในแต่ละหน้า */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};
