import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import {
  Company,
  Customer,
  Item,
  DocumentSummary,
  DocumentDetail,
  DocumentDefaults,
  DocNumberCheck,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocType,
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  /** ต่อ token PIN เป็น query string ให้ URL ที่ใช้เปิดตรง ๆ ผ่าน <a href> (ดาวน์โหลด PDF/Excel)
   *  เพราะ <a href> แนบ header เองไม่ได้เหมือน HttpClient ปกติ */
  private withToken(url: string): string {
    const token = this.auth.token();
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  }

  // -- company --
  getCompany(): Observable<Company> {
    return this.http.get<Company>(`${this.base}/company`);
  }
  updateCompany(payload: Partial<Company>): Observable<Company> {
    return this.http.put<Company>(`${this.base}/company`, payload);
  }

  // -- customers --
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.base}/customers`);
  }
  addCustomer(payload: Partial<Customer>): Observable<Customer> {
    return this.http.post<Customer>(`${this.base}/customers`, payload);
  }
  updateCustomer(id: number, payload: Partial<Customer>): Observable<Customer> {
    return this.http.put<Customer>(`${this.base}/customers/${id}`, payload);
  }
  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/customers/${id}`);
  }

  // -- items --
  getItems(): Observable<Item[]> {
    return this.http.get<Item[]>(`${this.base}/items`);
  }
  addItem(payload: Partial<Item>): Observable<Item> {
    return this.http.post<Item>(`${this.base}/items`, payload);
  }
  deleteItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/items/${id}`);
  }

  // -- documents --
  /** ลบเอกสาร — ไม่ระบุอะไรเลย = ลบทั้งหมด (รีเซ็ตเลขที่เอกสารกลับ 0001), ระบุ ids = ลบเฉพาะที่เลือก, ระบุ from/to = ลบตามช่วงวันที่ */
  deleteDocuments(opts: { ids?: number[]; from?: string; to?: string } = {}): Observable<{ ok: boolean; deleted: number }> {
    const params: string[] = [];
    if (opts.from) params.push(`from=${opts.from}`);
    if (opts.to) params.push(`to=${opts.to}`);
    const url = `${this.base}/documents${params.length ? '?' + params.join('&') : ''}`;
    return this.http.delete<{ ok: boolean; deleted: number }>(url, {
      body: opts.ids && opts.ids.length ? { ids: opts.ids } : undefined,
    });
  }
  getDocuments(type?: string): Observable<DocumentSummary[]> {
    const url = type ? `${this.base}/documents?type=${type}` : `${this.base}/documents`;
    return this.http.get<DocumentSummary[]>(url);
  }
  createDocument(payload: CreateDocumentPayload): Observable<DocumentSummary> {
    return this.http.post<DocumentSummary>(`${this.base}/documents`, payload);
  }
  getDocument(id: number): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`${this.base}/documents/${id}`);
  }
  updateDocument(id: number, payload: UpdateDocumentPayload): Observable<DocumentDetail> {
    return this.http.put<DocumentDetail>(`${this.base}/documents/${id}`, payload);
  }
  downloadPdfUrl(id: number): string {
    return this.withToken(`${this.base}/documents/${id}/pdf`);
  }
  previewDocumentPdf(payload: CreateDocumentPayload): Observable<Blob> {
    return this.http.post(`${this.base}/documents/preview`, payload, { responseType: 'blob' });
  }
  /** เช็คว่าวันที่ออกเอกสารที่เลือกย้อนหลังกว่าเอกสารล่าสุดของประเภท/เดือนเดียวกันหรือไม่ (excludeId กันชนกับตัวเองตอนแก้ไข) */
  checkDocNumberOrder(type: DocType, issueDate: string, excludeId?: number | null): Observable<DocNumberCheck> {
    let url = `${this.base}/documents/number-check?type=${type}&issue_date=${issueDate}`;
    if (excludeId) url += `&exclude_id=${excludeId}`;
    return this.http.get<DocNumberCheck>(url);
  }

  // -- ค่าเริ่มต้นของ "ตัวเลือกเอกสาร" ต่อประเภทเอกสาร (จำค่าที่ใช้ล่าสุด) --
  getDocumentDefaults(type: DocType): Observable<DocumentDefaults> {
    return this.http.get<DocumentDefaults>(`${this.base}/document-defaults/${type}`);
  }
  saveDocumentDefaults(type: DocType, payload: DocumentDefaults): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/document-defaults/${type}`, payload);
  }

  // -- excel --
  exportExcelUrl(): string {
    return this.withToken(`${this.base}/excel/export`);
  }
  importExcel(file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.base}/excel/import`, form);
  }

  // -- ข้อมูลสำรองทั้งระบบ (ใช้ตอน supabase เข้าไม่ได้ / ต้องการกู้คืนข้อมูล) --
  exportBackupUrl(): string {
    return this.withToken(`${this.base}/backup/export`);
  }
  restoreBackup(file: File, mode: 'replace' | 'merge' = 'replace'): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    return this.http.post(`${this.base}/backup/restore`, form);
  }
}
