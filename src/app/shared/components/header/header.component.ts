import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SettingsService } from '../../../core/services/settings.service';
import { OrderService } from '../../../core/services/order.service';
import { MenuService } from '../../../core/services/menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit, OnDestroy {
  private settingsService = inject(SettingsService);
  private orderService = inject(OrderService);
  private menuService = inject(MenuService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly settings = this.settingsService.settings;
  readonly cartCount = this.orderService.cartItemCount;
  readonly activeKdsCount = () => this.orderService.activeOrders().length;
  readonly soldOutCount = this.menuService.soldOutCount;
  readonly currentStall = this.authService.currentStall;

  currentTime = signal<string>('');
  private timerInterval: any;

  ngOnInit(): void {
    this.updateClock();
    this.timerInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  onLogout(): void {
    this.authService.logout();
  }

  toggleTheme(): void {
    this.settingsService.toggleTheme();
  }

  toggleSound(): void {
    this.settingsService.toggleSound();
  }
}
