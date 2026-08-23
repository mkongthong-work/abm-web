import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** แนบ token PIN ไปกับทุก request (header X-ABM-Token) และถ้าเซิร์ฟเวอร์ตอบ 401 (PIN ไม่ถูกต้อง/ถูกเปลี่ยนไปแล้ว)
 *  ให้ล้าง token ทิ้งอัตโนมัติ เพื่อเด้งกลับไปหน้ากรอก PIN */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authedReq = token ? req.clone({ setHeaders: { 'X-ABM-Token': token } }) : req;
  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) auth.logout();
      return throwError(() => err);
    })
  );
};
