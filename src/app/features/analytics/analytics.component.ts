import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../core/services/analytics.service';
import { SettingsService } from '../../core/services/settings.service';
import { OrderService } from '../../core/services/order.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './analytics.component.html'
})
export class AnalyticsComponent {
  private analyticsService = inject(AnalyticsService);
  private settingsService = inject(SettingsService);
  private orderService = inject(OrderService);

  readonly summary = this.analyticsService.shiftSummary;
  readonly hourlyData = this.analyticsService.hourlySales;
  readonly settings = this.settingsService.settings;

  showCloseShiftModal = signal<boolean>(false);

  printShiftReport(): void {
    window.print();
  }

  resetOrdersData(): void {
    if (confirm('Clear all orders in the current shift?')) {
      this.orderService.resetOrders();
    }
  }

}
