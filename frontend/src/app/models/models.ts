export interface Customer {
  id: number;
  name: string;
  address?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
}

export interface Item {
  id: number;
  name: string;
  description?: string;
  unit: string;
  unit_price: number;
}

export type DocType = 'quotation' | 'invoice' | 'receipt';

export interface DocumentSummary {
  id: number;
  doc_type: DocType;
  doc_number: string;
  customer_name: string;
  issue_date: string;
  due_date?: string;
  status: string;
  total: number;
}

export interface DocumentLine {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface CreateDocumentPayload {
  type: DocType;
  customer_id: number;
  lines: DocumentLine[];
  vat_rate?: number;
  discount?: number;
  note?: string;
}
