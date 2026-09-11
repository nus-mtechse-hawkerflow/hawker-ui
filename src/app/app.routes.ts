import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'pos',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'pos',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent)
  },
  {
    path: 'kds',
    canActivate: [authGuard],
    loadComponent: () => import('./features/kds/kds.component').then(m => m.KdsComponent)
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/orders.component').then(m => m.OrdersComponent)
  },
  {
    path: 'menu',
    canActivate: [authGuard],
    loadComponent: () => import('./features/menu-admin/menu-admin.component').then(m => m.MenuAdminComponent)
  },
  {
    path: 'analytics',
    canActivate: [authGuard],
    loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent)
  },
  {
    path: '**',
    redirectTo: 'pos'
  }
];
