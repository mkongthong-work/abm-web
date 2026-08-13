import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DocumentSummary } from '../../models/models';

const TYPE_LABEL: Record<string, string> = {
  quotation: 'ใบเสนอราคา',
  invoice: 'ใบแจ้งหนี้',
  receipt: 'ใบเสร็จรับเงิน',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  paid: 'ชำระแล้ว',
  void: 'ยกเลิก',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-draft',
  sent: 'badge-sent',
  paid: 'badge-paid',
  void: 'badge-void',
};

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './documents.component.html',
})
export class DocumentsComponent implements OnInit {
  documents: DocumentSummary[] = [];
  loading = false;
  typeLabel = TYPE_LABEL;
  statusLabel = STATUS_LABEL;
  statusBadge = STATUS_BADGE;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.api.getDocuments().subscribe({
      next: (data) => {
        this.documents = data;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  pdfUrl(id: number) {
    return this.api.downloadPdfUrl(id);
  }
}
