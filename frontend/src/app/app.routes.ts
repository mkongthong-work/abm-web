import { Routes } from '@angular/router';
import { CustomersComponent } from './pages/customers/customers.component';
import { ItemsComponent } from './pages/items/items.component';
import { DocumentsComponent } from './pages/documents/documents.component';
import { DocumentFormComponent } from './pages/document-form/document-form.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'documents', pathMatch: 'full' },
  { path: 'customers', component: CustomersComponent },
  { path: 'items', component: ItemsComponent },
  { path: 'documents', component: DocumentsComponent },
  { path: 'documents/new', component: DocumentFormComponent },
  { path: 'documents/:id/edit', component: DocumentFormComponent },
  { path: 'settings', component: SettingsComponent },
];
