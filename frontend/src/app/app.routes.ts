import { Routes } from '@angular/router';
import { CustomersComponent } from './pages/customers/customers.component';
import { ItemsComponent } from './pages/items/items.component';
import { DocumentsComponent } from './pages/documents/documents.component';
import { DocumentFormComponent } from './pages/document-form/document-form.component';
import { DocumentDetailComponent } from './pages/document-detail/document-detail.component';
import { VatDashboardComponent } from './pages/vat-dashboard/vat-dashboard.component';
import { VatFilersComponent } from './pages/vat-filers/vat-filers.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', component: VatDashboardComponent, pathMatch: 'full' },
  { path: 'vat-filers', component: VatFilersComponent },
  { path: 'customers', component: CustomersComponent },
  { path: 'items', component: ItemsComponent },
  { path: 'documents', component: DocumentsComponent },
  { path: 'documents/new', component: DocumentFormComponent },
  { path: 'documents/:id/edit', component: DocumentFormComponent },
  { path: 'documents/:id/view', component: DocumentDetailComponent },
  { path: 'settings', component: SettingsComponent },
];
