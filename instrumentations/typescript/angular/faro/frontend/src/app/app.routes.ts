import { Routes } from '@angular/router';
import { DocsComponent } from './pages/docs/docs.component';
import { HomeComponent } from './pages/home/home.component';
import { OtelComponent } from './pages/otel/otel.component';
import { PasswordComponent } from './pages/password/password.component';
import { PrivacyComponent } from './pages/privacy/privacy.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'docs', component: DocsComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'otel', component: OtelComponent },
  { path: 'password', component: PasswordComponent },
  { path: '**', redirectTo: '' }
];
