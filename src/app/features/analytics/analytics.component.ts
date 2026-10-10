import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './analytics.component.html'
})
export class AnalyticsComponent {
  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private settingsService = inject(SettingsService);

  readonly summary = this.analyticsService.summary;
  readonly status = this.analyticsService.status;
  readonly errorMessage = this.analyticsService.errorMessage;
  readonly selectedDate = this.analyticsService.selectedDate;
  readonly settings = this.settingsService.settings;

  /** Scale the chart to the busiest hour, so any volume renders sensibly. */
  readonly maxHourlyCount = computed(() => {
    const buckets = this.summary()?.hourlyOrders ?? [];
    return Math.max(1, ...buckets.map(b => b.orderCount));
  });

  constructor() {
    // Fetch on load and whenever the signed-in stall changes. The previous
    // version fetched nothing at all, so this screen showed zeros unless the
    // user had visited KDS or Orders first to populate OrderService.
    effect(() => {
      const stall = this.authService.currentStall();
      const session = this.authService.currentSession();
      this.analyticsService.loadForStall(stall, session, this.selectedDate());
    });
  }

  onDateChange(isoDate: string): void {
    this.analyticsService.setDate(isoDate);
  }

  refresh(): void {
    this.analyticsService.retry();
  }

  printDailySummary(): void {
    window.print();
  }

  barHeightPercent(orderCount: number): number {
    return Math.round((orderCount / this.maxHourlyCount()) * 100);
  }

  formatHour(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }
}
