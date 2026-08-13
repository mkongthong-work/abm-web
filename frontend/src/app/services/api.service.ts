import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Customer,
  Item,
  DocumentSummary,
  CreateDocumentPayload,
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // -- customers --
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.base}/customers`);
  }
  addCustomer(payload: Partial<Customer>): Observable<Customer> {
    return this.http.post<Customer>(`${this.base}/customers`, payload);
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
  getDocuments(type?: string): Observable<DocumentSummary[]> {
    const url = type ? `${this.base}/documents?type=${type}` : `${this.base}/documents`;
    return this.http.get<DocumentSummary[]>(url);
  }
  createDocument(payload: CreateDocumentPayload): Observable<DocumentSummary> {
    return this.http.post<DocumentSummary>(`${this.base}/documents`, payload);
  }
  downloadPdfUrl(id: number): string {
    return `${this.base}/documents/${id}/pdf`;
  }

  // -- excel --
  exportExcelUrl(): string {
    return `${this.base}/excel/export`;
  }
  importExcel(file: File): Observable<any> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.base}/excel/import`, form);
  }
}
