import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'abm_token';

/**
 * ด่านกันเข้าแบบ PIN เดียวใช้ร่วมกันทั้งบริษัท (ยังไม่ใช่ระบบผู้ใช้แยกรายบุคคล — เป็นการป้องกันชั่วคราว
 * ก่อนที่แอปจะขึ้น Render ให้เข้าถึงผ่านอินเทอร์เน็ตได้) เก็บ token ไว้ใน localStorage เพื่อให้ล็อกอินค้างไว้ได้
 * ข้ามการเปิดแอปใหม่ ไม่มีวันหมดอายุเอง — ถ้า PIN ถูกเปลี่ยนฝั่งเซิร์ฟเวอร์ token เดิมจะใช้ไม่ได้ทันที (เจอ 401 แล้วเด้งกลับมาหน้า PIN)
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiBaseUrl;
  token = signal<string | null>(localStorage.getItem(STORAGE_KEY));

  constructor(private http: HttpClient) {}

  login(pin: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/auth/login`, { pin }).pipe(
      tap((res) => {
        localStorage.setItem(STORAGE_KEY, res.token);
        this.token.set(res.token);
      })
    );
  }

  logout() {
    localStorage.removeItem(STORAGE_KEY);
    this.token.set(null);
  }
}
